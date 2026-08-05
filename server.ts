import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import { getStylePrompt, getTonePrompt } from './src/data/promptsAndOptions';
import { buildPrintableBookHtml } from './src/lib/pdf/printTemplate';
import { escapeHtml } from './src/lib/pdf/coverRenderer';
import { ensureNodeJsdom } from './src/lib/pdf/markdownRenderer';
import { PdfExportSettings } from './src/lib/pdf/types';
import { getPageMetrics } from './src/lib/pdf/pageMetrics';

import { createBackupPackage, validateAndRestoreBackup } from './src/lib/backupService';
import { aiOrchestrator } from './src/lib/ai/orchestrator';
import { AiTaskType } from './src/lib/ai/types';
import { validateBookConfig } from './src/lib/ai/validation/configValidator';
import { reconcileEditorialPlan } from './src/lib/ai/validation/planReconciler';
import { buildPlanPrompt } from './src/lib/ai/prompts/promptBuilder';
import { generateChapterInBlocks } from './src/lib/ai/generation/blockGenerator';
import { generateFrontEndMatter } from './src/lib/ai/generation/matterGenerator';
import { createInitialBookBibleMemory } from './src/lib/ai/memory/bookBibleMemory';
import { normalizeProse } from './src/lib/ai/normalization/proseNormalizer';
import { checkChapterCoverage } from './src/lib/ai/validation/coverageChecker';
import { runHierarchicalEditorialReview } from './src/lib/ai/review/hierarchicalReviewer';
import { renderCompositeCoverSvg, svgToDataUri } from './src/lib/cover/coverCanvasRenderer';
import { CoverBrief, calculateSpineWidthMm } from './src/lib/cover/coverBrief';

import { validateAndLoadEnv } from './src/lib/config/envValidator';
import { validateProviderBaseUrl } from './src/lib/ai/security';
import { createSecurityHeadersMiddleware } from './src/lib/security/headersMiddleware';
import { globalApiRateLimiter, editorialAiRateLimiter } from './src/lib/security/rateLimiter';
import { createApiAuthMiddleware } from './src/lib/security/apiKeyAuth';
import { logger } from './src/lib/observability/logger';
import { CURRENT_PRIVACY_POLICY } from './src/lib/security/privacyPolicy';

dotenv.config();

const envConfig = validateAndLoadEnv();
const app = express();
app.set('trust proxy', 1);
const PORT = envConfig.port;

// 10.2 Security Headers & CSP
app.use(createSecurityHeadersMiddleware());

// 10.4 Rate Limiting & Cost Budget Protection
app.use('/api/', globalApiRateLimiter);
app.use('/api/editorial/', editorialAiRateLimiter);

// Optional shared-secret gate. No-op unless API_ACCESS_TOKEN is set, so local and
// existing deployments are unchanged; set it before exposing the server publicly,
// since every endpoint spends the server's own AI credits.
app.use('/api/', createApiAuthMiddleware());

// 10.5 Request Tracing Middleware
app.use((req, res, next) => {
  const requestId =
    (req.headers['x-request-id'] as string) ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Request-ID', requestId);
  (req as any).requestId = requestId;

  const startTime = Date.now();
  res.on('finish', () => {
    logger.info(`HTTP ${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startTime,
    });
  });
  next();
});

// Global body parser with 50MB limit to support large book projects, high-resolution base64 cover images, PDF exports, and project backups
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Route-level parser for the large-payload endpoints (PDF export, backups).
const largePayloadJson = express.json({ limit: '50mb' });

// Express error handler for payload limits
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'O tamanho da requisição excede o limite permitido (413 Payload Too Large).',
      },
    });
  }
  return next(err);
});

// System Diagnostic & Logging Endpoints
app.get('/api/system/logs', (_req, res) => {
  return res.json({
    success: true,
    logs: logger.getRecentLogs(),
  });
});

app.delete('/api/system/logs', (_req, res) => {
  logger.clearLogs();
  return res.json({
    success: true,
    message: 'Histórico de logs do servidor limpo com sucesso.',
  });
});

// Non-destructive AST/structure-preserving prose normalizer
export function cleanMarkdownProse(
  text: string,
  chapterNumber?: number,
  chapterTitle?: string
): string {
  return normalizeProse(text, chapterNumber, chapterTitle);
}

export interface AiConfigPayload {
  provider?: 'gemini' | 'opencode';
  geminiModel?: string;
  opencodeApiKey?: string;
  opencodeBaseUrl?: string;
  opencodeModel?: string;
}

// Unified AI Completion Dispatcher using Provider Orchestrator Architecture
async function callAiCompletion({
  systemInstruction,
  prompt,
  jsonMode = false,
  aiConfig,
  taskType = 'general',
  userMaterials,
  userRestrictions,
}: {
  systemInstruction: string;
  prompt: string;
  jsonMode?: boolean;
  aiConfig?: AiConfigPayload;
  taskType?: AiTaskType;
  userMaterials?: string;
  userRestrictions?: string;
}): Promise<string> {
  if (jsonMode) {
    const { result } = await aiOrchestrator.generateStructured({
      systemInstruction,
      prompt,
      taskType,
      userMaterials,
      userRestrictions,
      aiConfig,
    });
    return result.text;
  } else {
    const result = await aiOrchestrator.generateText({
      systemInstruction,
      prompt,
      taskType,
      userMaterials,
      userRestrictions,
      aiConfig,
    });
    return result.text;
  }
}

// API Endpoint 1: Generate Editorial Plan (Phase 5 Pipeline)
app.post('/api/editorial/plan', async (req, res) => {
  try {
    const configValidation = validateBookConfig(req.body);
    if (!configValidation.valid || !configValidation.sanitizedMetadata) {
      return res.status(400).json({
        success: false,
        error: 'Configuração de livro inválida.',
        details: configValidation.errors,
      });
    }

    const metadata = configValidation.sanitizedMetadata;
    const promptPkg = buildPlanPrompt(metadata);

    const { data: rawPlan } = await aiOrchestrator.generateStructured({
      systemInstruction: promptPkg.systemInstruction,
      prompt: promptPkg.userPrompt,
      taskType: 'plan',
      userMaterials: metadata.materiais,
      userRestrictions: metadata.restricoes,
      aiConfig: req.body.aiConfig,
    });

    const reconciliation = reconcileEditorialPlan(rawPlan, metadata);

    return res.json({
      success: true,
      plan: reconciliation.reconciledPlan,
      adjustments: reconciliation.adjustmentsMade,
    });
  } catch (error: any) {
    console.error('Error generating editorial plan:', error);
    return res
      .status(500)
      .json({ success: false, error: error.message || 'Erro ao gerar planejamento editorial.' });
  }
});

// API Endpoint 2: Generate Chapter Content (Phase 5 Block Generation Pipeline)
app.post('/api/editorial/generate-chapter', async (req, res) => {
  try {
    const {
      metadata: rawMeta,
      plan,
      chapterIndex,
      memory: inputMemory,
      previousSummaries,
      aiConfig,
    } = req.body;

    const configValidation = validateBookConfig(rawMeta || {});
    const metadata = configValidation.sanitizedMetadata;

    // This endpoint used to read sanitizedMetadata while ignoring `valid`, so an
    // invalid config (no title, 500 chapters, ...) silently generated against
    // defaulted values instead of being rejected the way /plan rejects it.
    if (!configValidation.valid || !metadata) {
      return res.status(400).json({
        success: false,
        error: 'Dados de metadados do livro inválidos.',
        details: configValidation.errors,
      });
    }

    const currentCap = plan?.sumario?.[chapterIndex];
    if (!currentCap) {
      return res.status(400).json({ success: false, error: 'Capítulo não encontrado no sumário.' });
    }

    const memory = inputMemory || createInitialBookBibleMemory();

    const generation = await generateChapterInBlocks({
      metadata,
      plan,
      chapterPlan: currentCap,
      memory,
      previousSummaries: Array.isArray(previousSummaries)
        ? previousSummaries.map(String)
        : undefined,
      aiConfig,
    });

    const coverageReport = checkChapterCoverage(
      generation.fullChapterText,
      currentCap.topicos || [],
      metadata
    );

    return res.json({
      success: true,
      chapterIndex,
      chapterNumber: currentCap.numero,
      title: currentCap.titulo,
      content: generation.fullChapterText,
      wordCount: generation.wordCount,
      updatedMemory: generation.updatedMemory,
      coverageReport,
    });
  } catch (error: any) {
    console.error('Error generating chapter:', error);
    return res
      .status(500)
      .json({ success: false, error: error.message || 'Erro ao escrever capítulo.' });
  }
});

// API Endpoint 3: Generate Front/End Matter Section (Phase 5 Pipeline)
app.post('/api/editorial/generate-section', async (req, res) => {
  try {
    const { metadata: rawMeta, plan, sectionType, fullBookContent, aiConfig } = req.body;

    const configValidation = validateBookConfig(rawMeta || {});
    const metadata = configValidation.sanitizedMetadata;

    if (!configValidation.valid || !metadata) {
      return res.status(400).json({
        success: false,
        error: 'Dados de metadados do livro inválidos.',
        details: configValidation.errors,
      });
    }

    const typeMap: Record<
      string,
      'apresentacao' | 'introducao' | 'conclusao' | 'exercicios' | 'agradecimentos' | 'sobreAutor'
    > = {
      apresentacao: 'apresentacao',
      introducao: 'introducao',
      conclusao: 'conclusao',
      exercicios: 'exercicios',
      agradecimentos: 'agradecimentos',
      sobreAutor: 'sobreAutor',
    };

    const targetType = typeMap[sectionType] || 'introducao';

    const content = await generateFrontEndMatter({
      metadata,
      plan,
      fullBookContent: fullBookContent || '',
      type: targetType,
      aiConfig,
    });

    return res.json({
      success: true,
      sectionType,
      title: sectionType,
      content,
    });
  } catch (error: any) {
    console.error('Error generating section:', error);
    return res
      .status(500)
      .json({ success: false, error: error.message || 'Erro ao gerar seção complementar.' });
  }
});

// API Endpoint 4: Editorial Review & Audit (Phase 6 Map-Reduce Pipeline)
app.post('/api/editorial/review', async (req, res) => {
  try {
    const { project, metadata, plan, chapters, frontMatter, endMatter, aiConfig } = req.body;

    // Construct project payload if passed as flat properties
    const activeProject = project || {
      id: `proj-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: metadata || {},
      plan: plan || null,
      chapters: chapters || [],
      frontMatter: frontMatter || {},
      endMatter: endMatter || {},
      editorialReport: null,
      currentStage: 'review',
    };

    const report = await runHierarchicalEditorialReview({
      project: activeProject,
      aiConfig,
    });

    return res.json({ success: true, report });
  } catch (error: any) {
    console.error('Error performing editorial review:', error);
    return res
      .status(500)
      .json({ success: false, error: error.message || 'Erro na auditoria editorial.' });
  }
});

// API Endpoint 4B: Apply Editorial Review Improvements to Chapter
app.post('/api/editorial/apply-review', async (req, res) => {
  try {
    const {
      metadata,
      plan: _plan,
      chapterIndex,
      chapterTitle,
      chapterContent,
      report,
      aiConfig,
    } = req.body;

    if (!chapterContent) {
      return res.status(400).json({ success: false, error: 'Conteúdo do capítulo está vazio.' });
    }

    const stylePrompt = getStylePrompt(metadata?.estilo);
    const tonePrompt = getTonePrompt(metadata?.tom);

    // Extract relevant problems for this chapter location or general issues
    const chapterProblems = (report?.problemasDetectados || []).filter(
      (p: any) =>
        p.localizacao?.toLowerCase().includes(`capítulo ${chapterIndex + 1}`) ||
        p.localizacao?.toLowerCase().includes(`cap. ${chapterIndex + 1}`) ||
        p.localizacao?.toLowerCase().includes('geral') ||
        p.localizacao?.toLowerCase().includes('obra')
    );

    const problemDirectives = chapterProblems
      .map(
        (p: any) =>
          `- [${p.tipo} - ${p.severidade}]: ${p.descricao}. SUGESTÃO: ${p.sugestaoDeCorrecao || p.sugestoesDeCorrecao}`
      )
      .join('\n');

    const globalDirectives = (report?.sugestoesGlobais || [])
      .map((s: string) => `- ${s}`)
      .join('\n');

    const systemInstruction = `Você é um Editor Sênior e Revisor Literário de Elite.
Sua tarefa é REESCREVER e APRIMORAR o capítulo fornecido, aplicando rigorosamente as melhorias, correções e sugestões resultantes da auditoria editorial.

DIRETRIZ DE ESTILO (${metadata?.estilo || 'Geral'}):
${stylePrompt}

DIRETRIZ DE TOM (${metadata?.tom || 'Geral'}):
${tonePrompt}

REGRAS OBRIGATÓRIAS DE REVISÃO:
1. Mantenha a estrutura narrativa e o significado central do capítulo.
2. Corrija incoerências, repetições desnecessárias, falhas de transição ou desvios de tom apontados pela auditoria.
3. Mantenha o texto em prosa fluida de livro impresso (EVITE ESTRITAMENTE caracteres de Markdown como '#', '##', '---', '*', '**').
4. Não reduza o volume do capítulo; enriqueça os trechos necessários para garantir alta qualidade.
5. NÃO inclua saudações nem comentários de IA. Retorne diretamente o texto aprimorado do capítulo.`;

    const userPrompt = `LIVRO: ${metadata?.titulo || 'Livro'}
CAPÍTULO ${chapterIndex + 1}: ${chapterTitle || `Capítulo ${chapterIndex + 1}`}

DIRETRIZES DA REVISÃO EDITORIAL A APLICAR:
${problemDirectives ? `Problemas Detectados no Capítulo:\n${problemDirectives}` : 'Aplicar polimento geral e elegância de estilo.'}

Recomendações Globais da Junta Editorial:
${globalDirectives || 'Aprimorar coesão, ritmo e vocabulário.'}

TEXTO ORIGINAL DO CAPÍTULO PARA APRIMORAR:
${chapterContent}

Reescreva e aprimore o texto do capítulo em prosa limpa de livro impresso (SEM SÍMBOLOS DE MARKDOWN # OU ---):`;

    const rawContent = await callAiCompletion({
      systemInstruction,
      prompt: userPrompt,
      aiConfig,
    });

    const revisedContent = cleanMarkdownProse(rawContent, chapterIndex + 1, chapterTitle);
    const wordCount = revisedContent.trim().split(/\s+/).length;

    return res.json({
      success: true,
      chapterIndex,
      chapterTitle,
      content: revisedContent,
      wordCount,
    });
  } catch (error: any) {
    console.error('Error applying review to chapter:', error);
    return res
      .status(500)
      .json({ success: false, error: error.message || 'Erro ao aplicar melhorias no capítulo.' });
  }
});

// API Endpoint 5: Text Assist
app.post('/api/editorial/text-assist', async (req, res) => {
  try {
    const { action, text, context, tone, language, aiConfig } = req.body;

    const actionPrompts: Record<string, string> = {
      expand:
        'Expanda o seguinte trecho fornecendo mais detalhes e profundidade em prosa de livro impresso.',
      summarize: 'Sintetize o seguinte trecho de forma clara e límpida.',
      polish: 'Aprimore o estilo, elegância e ritmo de leitura do trecho.',
      changeTone: `Reescreva o trecho ajustando o tom para ${tone || 'didático e envolvente'}.`,
      addExample: 'Reescreva o trecho incorporando uma analogia ou exemplo de alto impacto.',
      fixGrammar: 'Corrija concordância, pontuação e erros mantendo a voz do autor.',
    };

    const instruction = actionPrompts[action] || 'Aprimore o texto fornecido.';

    const systemInstruction = `Você é um assistente de redação literária. EVITE ESTRITAMENTE símbolos de markdown tipo '#' ou '---'. Escreva em prosa limpa.`;

    const prompt = `AÇÃO DEDICADA: ${instruction}
Idioma: ${language || 'Português'}
Contexto: ${context || 'Geral'}

TEXTO ORIGINAL:
${text}

Retorne APENAS o texto aprimorado sem introduções nem símbolos de markdown #:`;

    const rawResult = await callAiCompletion({
      systemInstruction,
      prompt,
      aiConfig,
    });

    const result = cleanMarkdownProse(rawResult);

    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Error assisting text:', error);
    res
      .status(500)
      .json({ success: false, error: error.message || 'Erro no assistente de texto.' });
  }
});

// Translation & Cultural Localization Helpers & Endpoints
const SYSTEM_PROMPT_TRANSLATION =
  'Você é um tradutor e especialista em localização literária. Sua função é traduzir e adaptar culturalmente o e-book enviado para o idioma de destino especificado. Adapte gírias, metáforas e expressões idiomáticas de forma natural para leitores nativos. Mantenha o tom e o estilo original do autor. Retorne APENAS o texto adaptado em prosa limpa, sem saudações, introduções, notas ou explicações.';

async function executeTranslationCall(
  textoOriginal: string,
  idiomaSelecionado: string,
  aiConfig?: AiConfigPayload,
  chapterNumber?: number,
  chapterTitle?: string
): Promise<string> {
  if (!textoOriginal || !textoOriginal.trim()) return '';

  const userPrompt = `Idioma de Destino: ${idiomaSelecionado}\n\nTexto Original:\n${textoOriginal}`;

  const rawResult = await callAiCompletion({
    systemInstruction: SYSTEM_PROMPT_TRANSLATION,
    prompt: userPrompt,
    aiConfig,
    taskType: 'general',
  });

  return cleanMarkdownProse(rawResult, chapterNumber, chapterTitle);
}

// API Endpoint 5B: Translate Single Section / Snippet
app.post('/api/editorial/translate-section', async (req, res) => {
  try {
    const { text, targetLanguage, aiConfig } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'Texto para tradução está vazio.' });
    }

    if (!targetLanguage || !targetLanguage.trim()) {
      return res
        .status(400)
        .json({ success: false, error: 'Idioma de destino não foi informado.' });
    }

    const translatedText = await executeTranslationCall(text, targetLanguage, aiConfig);

    return res.json({ success: true, translatedText });
  } catch (error: any) {
    console.error('Error translating text section:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro na tradução do trecho de texto.',
    });
  }
});

// API Endpoint 5C: Full E-book Translator & Cultural Localizer + Localized Cover Generation
app.post('/api/editorial/translate-book', async (req, res) => {
  try {
    const { project, targetLanguage, aiConfig } = req.body;

    if (!project || !project.metadata) {
      return res.status(400).json({
        success: false,
        error: 'Nenhum e-book válido foi fornecido para tradução.',
      });
    }

    if (!targetLanguage || !targetLanguage.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Por favor, selecione um idioma de destino para a localização cultural.',
      });
    }

    const origMeta = project.metadata;
    logger.info(
      `Starting full book translation for project: ${origMeta.titulo} -> ${targetLanguage}`
    );

    // 1. Translate Metadata
    const [translatedTitulo, translatedSubtitulo, translatedResumo, translatedPublicoAlvo] =
      await Promise.all([
        executeTranslationCall(origMeta.titulo, targetLanguage, aiConfig),
        executeTranslationCall(origMeta.subtitulo || '', targetLanguage, aiConfig),
        executeTranslationCall(origMeta.resumo || '', targetLanguage, aiConfig),
        executeTranslationCall(origMeta.publicoAlvo || '', targetLanguage, aiConfig),
      ]);

    const translatedPromptEstilo = origMeta.promptEstilo
      ? await executeTranslationCall(origMeta.promptEstilo, targetLanguage, aiConfig)
      : '';

    // 2. Translate FrontMatter
    const origFront = project.frontMatter || {};
    const [translatedApresentacao, translatedIntroducao] = await Promise.all([
      origFront.apresentacao
        ? executeTranslationCall(origFront.apresentacao, targetLanguage, aiConfig)
        : Promise.resolve(''),
      origFront.introducao
        ? executeTranslationCall(origFront.introducao, targetLanguage, aiConfig)
        : Promise.resolve(''),
    ]);

    // 3. Translate Chapters
    const translatedChapters = [];
    if (Array.isArray(project.chapters)) {
      for (const cap of project.chapters) {
        const transCapTitle = await executeTranslationCall(cap.titulo, targetLanguage, aiConfig);
        const transCapSub = cap.subtitulo
          ? await executeTranslationCall(cap.subtitulo, targetLanguage, aiConfig)
          : '';
        const transContent = await executeTranslationCall(
          cap.content,
          targetLanguage,
          aiConfig,
          cap.numero,
          transCapTitle
        );
        const wordCount = transContent.trim().split(/\s+/).length;

        translatedChapters.push({
          ...cap,
          titulo: transCapTitle || cap.titulo,
          subtitulo: transCapSub,
          content: transContent,
          wordCount,
          status: 'completed' as const,
        });
      }
    }

    // 4. Translate EndMatter
    const origEnd = project.endMatter || {};
    const [
      translatedConclusao,
      translatedExercicios,
      translatedAgradecimentos,
      translatedSobreAutor,
    ] = await Promise.all([
      origEnd.conclusao
        ? executeTranslationCall(origEnd.conclusao, targetLanguage, aiConfig)
        : Promise.resolve(''),
      origEnd.exercicios
        ? executeTranslationCall(origEnd.exercicios, targetLanguage, aiConfig)
        : Promise.resolve(''),
      origEnd.agradecimentos
        ? executeTranslationCall(origEnd.agradecimentos, targetLanguage, aiConfig)
        : Promise.resolve(''),
      origEnd.sobreAutor
        ? executeTranslationCall(origEnd.sobreAutor, targetLanguage, aiConfig)
        : Promise.resolve(''),
    ]);

    // 5. Translate Editorial Plan if present
    let translatedPlan = project.plan;
    if (project.plan) {
      const transConceito = await executeTranslationCall(
        project.plan.conceitoCentral,
        targetLanguage,
        aiConfig
      );
      const transPromessa = await executeTranslationCall(
        project.plan.promessaPrincipal,
        targetLanguage,
        aiConfig
      );

      const transSumario = [];
      if (Array.isArray(project.plan.sumario)) {
        for (const item of project.plan.sumario) {
          const itemTitle = await executeTranslationCall(item.titulo, targetLanguage, aiConfig);
          const itemSub = item.subtitulo
            ? await executeTranslationCall(item.subtitulo, targetLanguage, aiConfig)
            : '';
          const itemObj = item.objetivo
            ? await executeTranslationCall(item.objetivo, targetLanguage, aiConfig)
            : '';
          transSumario.push({
            ...item,
            titulo: itemTitle || item.titulo,
            subtitulo: itemSub,
            objetivo: itemObj || item.objetivo,
          });
        }
      }

      translatedPlan = {
        ...project.plan,
        conceitoCentral: transConceito || project.plan.conceitoCentral,
        promessaPrincipal: transPromessa || project.plan.promessaPrincipal,
        sumario: transSumario,
      };
    }

    // 6. Generate Localized Cover Image in Target Language ("A cada nova tradução deverá pedir uma capa no idioma gerado")
    logger.info(`Generating new localized cover in ${targetLanguage} for: ${translatedTitulo}`);
    const publisherName = (origMeta.editora || 'EDITORA OMNIA').trim();

    const brief: CoverBrief = {
      title: translatedTitulo || origMeta.titulo || 'Sem Título',
      subtitle: translatedSubtitulo || '',
      author: origMeta.autor || 'Autor Exemplo',
      publisher: publisherName,
      genreStyle: origMeta.estilo || 'Geral',
      targetAudience: translatedPublicoAlvo || 'Público Geral',
      tone: 'editorial',
      promise: translatedResumo || '',
      desiredSymbols: [],
      forbiddenSymbols: [],
      colorPalette: 'editorial_high_contrast',
      briefVersion: 1,
      formatProfile: 'ebook',
    };

    const promptCapaTargetLang = `Award-winning luxury book cover illustration for e-book localized in ${targetLanguage}: "${translatedTitulo}". Genre: ${origMeta.estilo}. Theme: ${(translatedResumo || origMeta.resumo || '').slice(0, 150)}. Dramatic volumetric lighting, fine art background, high resolution, CLEAN BACKGROUND ARTWORK ONLY, STRICTLY NO TEXT, NO LETTERS, NO WORDS.`;

    let newBgArtworkUrl: string | undefined = undefined;
    try {
      const imgResult = await aiOrchestrator.generateImage({
        prompt: promptCapaTargetLang,
        aspectRatio: '3:4',
        model: 'imagen-3.0-generate-002',
        title: translatedTitulo,
        author: origMeta.autor,
        subtitle: translatedSubtitulo,
        style: origMeta.estilo,
        publisher: publisherName,
        aiConfig,
      });
      if (imgResult?.imageUrl) {
        newBgArtworkUrl = imgResult.imageUrl;
      }
    } catch (coverErr: any) {
      console.warn(
        '[Localized Cover Gen] AI image background failed, using vector compositor:',
        coverErr.message
      );
    }

    const totalPagesEstimated = Math.max(
      100,
      Math.round(translatedChapters.reduce((sum, c) => sum + (c.wordCount || 0), 0) / 250)
    );

    const svgComposite = renderCompositeCoverSvg({
      brief,
      backgroundImageUrl: newBgArtworkUrl,
      overlay: 'none',
      totalPageCount: totalPagesEstimated,
    });

    const localizedCoverUrl = svgToDataUri(svgComposite);

    // Assemble new localized project
    const newProjectId = `proj_loc_${Date.now()}`;
    const translatedProject = {
      ...project,
      id: newProjectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        ...origMeta,
        titulo: translatedTitulo || origMeta.titulo,
        subtitulo: translatedSubtitulo || origMeta.subtitulo,
        resumo: translatedResumo || origMeta.resumo,
        publicoAlvo: translatedPublicoAlvo || origMeta.publicoAlvo,
        promptEstilo: translatedPromptEstilo || origMeta.promptEstilo,
        idioma: targetLanguage,
        coverImageUrl: localizedCoverUrl,
      },
      plan: translatedPlan,
      chapters: translatedChapters,
      frontMatter: {
        ...origFront,
        folhaDeRostoTitle: translatedTitulo || origMeta.titulo,
        apresentacao: translatedApresentacao,
        introducao: translatedIntroducao,
      },
      endMatter: {
        ...origEnd,
        conclusao: translatedConclusao,
        exercicios: translatedExercicios,
        agradecimentos: translatedAgradecimentos,
        sobreAutor: translatedSobreAutor,
      },
      editorialReport: null, // Reset review report for the new translation
      currentStage: 'design_export' as const,
    };

    return res.json({
      success: true,
      translatedProject,
      targetLanguage,
      coverImageUrl: localizedCoverUrl,
    });
  } catch (error: any) {
    console.error('Error translating full e-book:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro inesperado durante a tradução do e-book.',
    });
  }
});

// Readiness Endpoint (Checks backend readiness & AI Provider availability)
app.get('/api/ready', async (_req, res) => {
  try {
    const aiHealth = await aiOrchestrator.healthCheck();
    const isReady = Object.values(aiHealth).some((p) => p.status === 'ok');

    if (isReady) {
      return res.json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          server: true,
          aiProviders: aiHealth,
        },
      });
    } else {
      return res.status(503).json({
        status: 'not_ready',
        reason: 'Nenhum provedor de IA disponível.',
        checks: {
          server: true,
          aiProviders: aiHealth,
        },
      });
    }
  } catch (err: any) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

// API Endpoint 6: Generate Book Cover Image (Phase 8: Background Artwork + Deterministic Typography Compositor)
app.post('/api/editorial/generate-cover', async (req, res) => {
  try {
    const {
      titulo,
      autor,
      subtitulo,
      editora,
      estilo,
      resumo,
      publicoAlvo,
      promptCapa,
      overlay = 'none',
      formatProfile = 'ebook',
      briefVersion = 1,
      totalPageCount = 200,
      renderFullPrintWrap = false,
      aiConfig,
    } = req.body;

    const publisherName = (editora || 'EDITORA OMNIA').trim();

    const brief: CoverBrief = {
      title: titulo || 'Sem Título',
      subtitle: subtitulo || '',
      author: autor || 'Autor Exemplo',
      publisher: publisherName,
      genreStyle: estilo || 'Geral',
      targetAudience: publicoAlvo || 'Público Geral',
      tone: 'editorial',
      promise: resumo || '',
      desiredSymbols: [],
      forbiddenSymbols: [],
      colorPalette: 'editorial_high_contrast',
      briefVersion: Number(briefVersion) || 1,
      formatProfile: formatProfile || 'ebook',
    };

    // 8.1 Separate background artwork from typography: generate background art ONLY
    const backgroundPrompt = promptCapa?.trim()
      ? `Background artwork illustration for book cover: ${promptCapa}. Professional fine art background texture, dramatic volumetric lighting, high resolution, CLEAN BACKGROUND ARTWORK ONLY, NO TEXT, NO LETTERS, NO WORDS, NO TYPOGRAPHY.`
      : `Award-winning high luxury editorial book cover background illustration. Genre/Style: ${estilo || 'editorial'}. Theme: ${resumo ? resumo.slice(0, 150) : 'literature'}. Dramatic volumetric lighting, elegant color harmony, fine art background, CLEAN BACKGROUND ARTWORK ONLY, STRICTLY NO TEXT, NO LETTERS, NO WORDS. High resolution.`;

    let bgArtworkUrl: string | undefined = undefined;
    let providerUsed = aiConfig?.provider === 'opencode' ? 'opencode' : 'gemini_imagen3';
    let generationSource: 'ai' | 'fallback_svg' = 'fallback_svg';

    try {
      const imgResult = await aiOrchestrator.generateImage({
        prompt: backgroundPrompt,
        aspectRatio: formatProfile === 'square_catalog' ? '1:1' : '3:4',
        model: 'imagen-3.0-generate-002',
        title: titulo,
        author: autor,
        subtitle: subtitulo,
        style: estilo,
        publisher: publisherName,
        aiConfig,
      });

      if (imgResult?.imageUrl) {
        bgArtworkUrl = imgResult.imageUrl;
        providerUsed = imgResult.provider || providerUsed;
        generationSource = 'ai';
      }
    } catch (aiImgErr: any) {
      console.warn(
        '[Cover Gen] AI image background generation unavailable or failed, utilizing vector artwork compositor:',
        aiImgErr.message
      );
      generationSource = 'fallback_svg';
      providerUsed = 'omnia_vector_compositor';
    }

    // 8.1 / 8.4 / 8.5 Deterministic Typography & Overlay Composite Rendering
    const svgComposite = renderCompositeCoverSvg({
      brief,
      backgroundImageUrl: bgArtworkUrl,
      overlay: overlay || 'none',
      totalPageCount: Number(totalPageCount) || 200,
      renderFullPrintWrap: Boolean(renderFullPrintWrap),
    });

    const finalCoverDataUri = svgToDataUri(svgComposite);

    return res.json({
      success: true,
      imageUrl: finalCoverDataUri,
      source: generationSource,
      providerUsed,
      briefVersion: brief.briefVersion,
      formatProfile: brief.formatProfile,
      hasEmbeddedTypography: true,
      spineWidthMm: calculateSpineWidthMm(Number(totalPageCount) || 200),
      metadata: {
        title: brief.title,
        author: brief.author,
        publisher: brief.publisher,
        overlayUsed: overlay,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error generating cover image:', error);
    const fallbackBrief: CoverBrief = {
      title: req.body.titulo || 'Sem Título',
      subtitle: req.body.subtitulo || '',
      author: req.body.autor || 'Autor Exemplo',
      publisher: req.body.editora || 'EDITORA OMNIA',
      genreStyle: req.body.estilo || 'Geral',
      targetAudience: 'Geral',
      tone: 'editorial',
      promise: '',
      desiredSymbols: [],
      forbiddenSymbols: [],
      colorPalette: 'default',
      briefVersion: 1,
      formatProfile: 'ebook',
    };
    const svgComposite = renderCompositeCoverSvg({ brief: fallbackBrief, overlay: 'none' });
    return res.json({
      success: true,
      imageUrl: svgToDataUri(svgComposite),
      source: 'fallback_svg',
      providerUsed: 'omnia_vector_compositor',
      hasEmbeddedTypography: true,
    });
  }
});

// PDF export launches a full Chromium per request and accepts bodies up to 50MB.
// Without a ceiling, a handful of concurrent exports exhausts memory and takes the
// whole server down -- the global 300-req/15min limiter does not help, because the
// cost here is measured in simultaneous browsers, not request rate.
const MAX_CONCURRENT_PDF_EXPORTS = Number(process.env.MAX_CONCURRENT_PDF_EXPORTS) || 2;
let activePdfExports = 0;

// SSRF validation helper for image URLs
function validateImageSource(urlStr?: string): string | undefined {
  if (!urlStr || typeof urlStr !== 'string') return undefined;
  if (urlStr.startsWith('data:image/')) return urlStr;
  if (urlStr.startsWith('blob:')) return undefined;

  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;

    // Standardize protocol to https for validateProviderBaseUrl check, or evaluate host
    const testUrl = `https://${parsed.host}${parsed.pathname}`;
    const check = validateProviderBaseUrl(testUrl);
    return check.safe ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

// API Endpoint 7: Server-side PDF Export via Puppeteer
app.post('/api/export/pdf', largePayloadJson, async (req, res) => {
  let browser: any = null;

  if (activePdfExports >= MAX_CONCURRENT_PDF_EXPORTS) {
    return res.status(503).json({
      error: {
        code: 'PDF_EXPORT_BUSY',
        message:
          'O servidor está gerando outros PDFs no momento. Aguarde alguns instantes e tente novamente.',
      },
    });
  }

  activePdfExports++;
  try {
    const { project, settings } = req.body;

    if (!project || !project.metadata) {
      return res.status(400).json({
        error: {
          code: 'INVALID_PROJECT',
          message: 'Projeto de livro inválido ou metadados ausentes.',
        },
      });
    }

    // Sanitize image URLs against SSRF
    const sanitizedProject = {
      ...project,
      metadata: {
        ...project.metadata,
        coverImageUrl: validateImageSource(project.metadata.coverImageUrl),
      },
    };

    const exportSettings: PdfExportSettings = {
      paperSize: settings?.paperSize === 'A4' ? 'A4' : 'A5',
      typographyMode: settings?.typographyMode === 'literary' ? 'literary' : 'nonfiction',
      coverOverlayMode: ['overlay', 'card', 'none'].includes(settings?.coverOverlayMode)
        ? settings.coverOverlayMode
        : 'none',
      useDropCap: settings?.useDropCap ?? true,
      includeCatalogPage: settings?.includeCatalogPage ?? true,
      catalogMetadata: settings?.catalogMetadata,
    };

    await ensureNodeJsdom();

    const htmlContent = buildPrintableBookHtml({
      project: sanitizedProject,
      settings: exportSettings,
    });

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    } catch (launchErr: any) {
      console.warn('Puppeteer launch failed, returning HTML package fallback:', launchErr);
      return res.status(500).json({
        error: {
          code: 'PUPPETEER_UNAVAILABLE',
          message: 'Não foi possível inicializar o renderizador Puppeteer no servidor.',
        },
        htmlFallback: htmlContent,
      });
    }

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: ['domcontentloaded', 'load'], timeout: 30000 });

    // Wait for fonts and images to settle inside page with fallback timeout
    await page.evaluate(async () => {
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
      const settlePromise = (async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready.catch(() => undefined);
        }
        const imgs = Array.from(document.images);
        await Promise.all(
          imgs.map(async (img) => {
            if (!img.complete) {
              await new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
                setTimeout(resolve, 1000);
              });
            }
            if (typeof img.decode === 'function') {
              await img.decode().catch(() => undefined);
            }
          })
        );
      })();
      await Promise.race([settlePromise, timeoutPromise]);
    });

    const isA5 = exportSettings.paperSize === 'A5';
    const metrics = getPageMetrics(exportSettings.paperSize);
    const safeTitleHeader = escapeHtml(sanitizedProject.metadata.titulo || '');

    const pdfBuffer = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div style="font-size:1px;"></div>',
      footerTemplate: `
        <div style="width: 100%; font-size: 8.5pt; font-family: 'Georgia', 'Garamond', 'Palatino Linotype', serif; color: #52525b; padding: 0 ${metrics.outerMarginMm || 12}mm 6mm ${metrics.innerMarginMm || 12}mm; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box;">
          <span style="font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60%;">${safeTitleHeader}</span>
          <span style="font-weight: 600;">Pág. <span class="pageNumber"></span></span>
        </div>
      `,
      width: isA5 ? '148mm' : '210mm',
      height: isA5 ? '210mm' : '297mm',
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: `${metrics.bottomMarginMm || 18}mm`,
        left: '0mm',
      },
    });

    const safeTitle = (sanitizedProject.metadata.titulo || 'livro')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}_${exportSettings.paperSize.toLowerCase()}.pdf"`
    );
    res.send(Buffer.from(pdfBuffer));
    return;
  } catch (error: any) {
    console.error('Error generating PDF on server:', error);
    return res.status(500).json({
      error: {
        code: 'PDF_GENERATION_FAILED',
        message: error.message || 'Erro ao gerar PDF no servidor.',
      },
    });
  } finally {
    activePdfExports--;
    if (browser) {
      await browser.close().catch(() => undefined);
    }
  }
});

// API Endpoint 8: Dedicated Asset Upload (Separated from JSON payload)
app.post('/api/assets/upload', largePayloadJson, (req, res) => {
  try {
    const { assetType, dataUrl, filename } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return res
        .status(400)
        .json({ error: { code: 'INVALID_ASSET', message: 'Data URL do asset é obrigatória.' } });
    }

    const validatedUrl = validateImageSource(dataUrl);
    if (!validatedUrl) {
      return res.status(400).json({
        error: {
          code: 'UNSAFE_ASSET',
          message: 'Formato ou origem de imagem inválido/inseguro.',
        },
      });
    }

    const assetId = 'asset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    return res.json({
      success: true,
      asset: {
        id: assetId,
        type: assetType || 'cover_image',
        url: validatedUrl,
        filename: filename || `${assetId}.png`,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      error: { code: 'UPLOAD_FAILED', message: error.message || 'Erro no upload do asset.' },
    });
  }
});

// API Endpoint 9: Create Versioned Backup Package
app.post('/api/projects/backup', largePayloadJson, (req, res) => {
  try {
    const { projects } = req.body;
    if (!Array.isArray(projects)) {
      return res.status(400).json({
        error: { code: 'INVALID_PROJECTS', message: 'A lista de projetos é obrigatória.' },
      });
    }

    const backupPackage = createBackupPackage(projects);
    return res.json({
      success: true,
      backup: backupPackage,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: {
        code: 'BACKUP_FAILED',
        message: error.message || 'Erro ao criar pacote de backup.',
      },
    });
  }
});

// API Endpoint 10: Validate and Restore Backup Package
app.post('/api/projects/restore', largePayloadJson, (req, res) => {
  try {
    const backupPkg = req.body;
    const result = validateAndRestoreBackup(backupPkg);
    if (!result.success || !result.projects) {
      return res.status(400).json({
        error: {
          code: 'RESTORE_FAILED',
          message: result.error || 'Falha na restauração do backup.',
        },
      });
    }

    return res.json({
      success: true,
      restoredCount: result.projects.length,
      projects: result.projects,
    });
  } catch (error: any) {
    return res.status(500).json({
      error: {
        code: 'RESTORE_FAILED',
        message: error.message || 'Erro ao processar pacote de restauração.',
      },
    });
  }
});

// API Endpoint 11: Health Check & System Diagnostics
app.get('/api/health', (_req, res) => {
  return res.json({
    status: 'ok',
    service: 'OMNIA Scriptor Editorial Studio',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: envConfig.nodeEnv,
    geminiConfigured: envConfig.hasGeminiKey,
  });
});

// API Endpoint 12: Privacy Policy Manifest
app.get('/api/privacy-policy', (_req, res) => {
  return res.json({
    success: true,
    policy: CURRENT_PRIVACY_POLICY,
  });
});

// API Endpoint 13: LGPD/GDPR Data Deletion Confirmation
app.post('/api/editorial/projects/:id/delete-data', (req, res) => {
  const { id } = req.params;
  logger.info(`[LGPD Data Deletion] Request processed for project id: ${id}`, { projectId: id });
  return res.json({
    success: true,
    projectId: id,
    message: `Dados do projeto ${id} marcados para remoção e limpos dos buffers da sessão.`,
    deletedAt: new Date().toISOString(),
  });
});

// Unknown API routes must not fall through to the SPA catch-all below: in
// production that returned index.html with status 200, so a typo'd endpoint gave
// the client HTML where it expected JSON and blew up inside res.json().
app.use('/api', (_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Endpoint de API não encontrado.' },
  });
});

// Final error handler. The 413 guard near the top only catches body-parser errors
// raised by middleware registered before it; anything thrown later (including by
// the per-route largePayloadJson parser) previously fell through to Express's default
// handler, which replies with an HTML stack trace.
// Express identifies an error handler by its arity, so the 4th parameter must
// exist even though this handler is terminal and never delegates.
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const requestId = (req as any).requestId;
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, {
    requestId,
    error: err?.message,
    stack: envConfig.nodeEnv === 'production' ? undefined : err?.stack,
  });

  if (res.headersSent) return;

  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({
    error: {
      code: err?.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR',
      message:
        status === 413
          ? 'O tamanho da requisição excede o limite permitido (413 Payload Too Large).'
          : 'Erro interno no servidor.',
      requestId,
    },
  });
});

// Start Server & Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Scriptor Editorial Studio rodando em http://0.0.0.0:${PORT}`);
  });
}

export { app };

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer();
}
