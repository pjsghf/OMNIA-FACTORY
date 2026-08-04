import { BookMetadata, EditorialPlan, ChapterPlan } from '../../../types';
import { BookBibleMemory, formatMemoryForPrompt } from '../memory/bookBibleMemory';
import { detectSensitiveNiche } from '../policies/sensitiveNichePolicy';
import { ChapterSectionPlan } from '../planning/chapterSectionPlanner';

/**
 * A fully-assembled, ready-to-send prompt pair plus the generation settings it
 * was designed for. `taskVersion` is descriptive metadata only — nothing in this
 * codebase parses or branches on it; it exists so a prompt can be identified in
 * logs/telemetry if that is added later.
 */
export interface PromptPackage {
  taskVersion: string;
  systemInstruction: string;
  userPrompt: string;
  jsonMode: boolean;
  temperature: number;
}

/**
 * Builds the prompt for Phase 1 of the pipeline: the editorial plan (concept,
 * reader profile, and chapter-by-chapter table of contents), as strict JSON.
 *
 * The returned prompt hardcodes `jsonMode: true` intent via its instructions,
 * but does not itself force JSON mode on the provider — the caller
 * (`aiOrchestrator.generateStructured`) is what actually sets
 * `responseMimeType: 'application/json'` / `response_format`. If a caller uses
 * this package with `generateText` instead of `generateStructured`, the model
 * will likely still return JSON-shaped text (the prompt asks for it), but
 * nothing enforces or parses it.
 *
 * Whatever this returns is expected to be run through
 * `validation/planReconciler.ts`'s `reconcileEditorialPlan` before use — this
 * function has no knowledge of `metadata.qtdCapitulos` being honored by the
 * model; reconciliation is what deterministically corrects a wrong chapter
 * count, out-of-range word estimates, etc.
 *
 * @param metadata - Book configuration; every field is interpolated directly
 *   into the prompt text (already sanitized upstream by `configValidator.ts`
 *   before this is called from `server.ts`).
 * @returns A {@link PromptPackage} with `temperature: 0.2` (favors consistent,
 *   structured output over creative variance) and `jsonMode: true`.
 */
export function buildPlanPrompt(metadata: BookMetadata): PromptPackage {
  const nichePolicy = detectSensitiveNiche(metadata);

  const systemInstruction = `Você é um consagrado Diretor Editorial e Arquiteto de Livros.
Sua missão é projetar um Planejamento Editorial Completo e Coeso para um livro inédito em ${metadata.idioma || 'Português'}.

INSTRUÇÃO DE ESTILO:
${metadata.promptEstilo || 'Estilo fluido e envolvente de não-ficção.'}

INSTRUÇÃO DE TOM:
${metadata.tom || 'Conversacional e didático.'}

${nichePolicy.type !== 'none' ? `DIRETRIZES PARA NICHO SENSÍVEL (${nichePolicy.type.toUpperCase()}):\n${nichePolicy.toneConstraints}\nAviso obrigatório: ${nichePolicy.mandatoryDisclaimer}` : ''}

REGRAS RÍGIDAS DE PLANEJAMENTO:
1. Projete EXATAMENTE ${metadata.qtdCapitulos} capítulos no sumário.
2. Cada capítulo deve ter estimativa entre ${metadata.minPalavras} e ${metadata.maxPalavras} palavras.
3. Não crie estruturas vazias.
4. Responda ESTRITAMENTE em formato JSON.`;

  const userPrompt = `PROJETO EDITORIAL DO LIVRO:
- Título: ${metadata.titulo}
- Subtítulo: ${metadata.subtitulo || ''}
- Autor: ${metadata.autor}
- Editora: ${metadata.editora || 'Editora OMNIA'}
- Idioma: ${metadata.idioma}
- Público-Alvo: ${metadata.publicoAlvo}
- Resumo e Visão do Livro: ${metadata.resumo}
- Estilo: ${metadata.estilo}
- Tom da Escrita: ${metadata.tom}
- Quantidade de Capítulos Solicitada: ${metadata.qtdCapitulos}
- Mínimo de Palavras por Capítulo: ${metadata.minPalavras}
- Máximo de Palavras por Capítulo: ${metadata.maxPalavras}
- Materiais e Trechos do Usuário: ${metadata.materiais || 'Nenhum'}
- Informações Obrigatórias a Incluir: ${metadata.informacoesObrigatorias || 'Nenhuma'}
- Restrições e Proibições: ${metadata.restricoes || 'Nenhuma'}

REGRAS DE CONCISÃO:
- Seja ultra-direto e sucinto nos valores dos campos para garantir um JSON completo sem cortes.
- Retorne no máximo 3 tópicos e 2 subtópicos por capítulo.

Gere a estrutura em JSON exato:
{
  "conceitoCentral": "string",
  "promessaPrincipal": "string",
  "perfilLeitor": {
    "descricao": "string",
    "doresEAnseios": ["string"],
    "oQueBuscaraNoLivro": ["string"]
  },
  "sumario": [
    {
      "numero": 1,
      "titulo": "string",
      "subtitulo": "string",
      "objetivo": "string",
      "topicos": ["string"],
      "subtopicos": ["string"],
      "estimativaPalavras": 1500
    }
  ]
}`;

  return {
    taskVersion: '2.0.0-plan',
    systemInstruction,
    userPrompt,
    jsonMode: true,
    temperature: 0.2,
  };
}

const PRECEDING_BLOCK_TAIL_CHARS = 1200;

/**
 * Builds the prompt for one block of one chapter — see
 * `generation/blockGenerator.ts`'s `generateChapterInBlocks` for the calling
 * loop and the full 3-layer continuity model this prompt is one piece of.
 *
 * Continuity context is assembled here from three optional sources, in this
 * priority order within the rendered prompt text:
 *   1. `memory` (formatted via `formatMemoryForPrompt`) — always included,
 *      renders a "no prior chapters" placeholder when empty rather than an
 *      empty string, so the model is never silently missing this section.
 *   2. `previousSummaries` — appended ONLY when `memory.resumosCapitulos` is
 *      still empty; once the BookBible has real entries, this fallback is
 *      dropped entirely (not merged) to avoid presenting two summaries of the
 *      same chapters with potentially different framings.
 *   3. `precedingBlockText` — the last {@link PRECEDING_BLOCK_TAIL_CHARS}
 *      characters of the immediately preceding block in the SAME chapter (not
 *      truncated at a word boundary — a mid-word cut is accepted as the cost of
 *      a simple, predictable slice).
 *
 * @param metadata - Book-level config (style/tone/language directives).
 * @param plan - Full editorial plan, if available; only `plan.conceitoCentral`
 *   is read (falls back to `metadata.resumo` if `plan` is absent).
 * @param chapterPlan - This chapter's plan entry.
 * @param sectionBlock - This specific block's plan (topics, purpose, word target).
 * @param memory - BookBible memory; see priority order above.
 * @param previousSummaries - Fallback chapter digests; see priority order above.
 * @param precedingBlockText - Raw text of the previous block in this chapter, if
 *   any (omit for the first block).
 * @returns A {@link PromptPackage} with `temperature: 0.65` (favors prose
 *   variety over the low-temperature structured-output settings used
 *   elsewhere) and `jsonMode: false`.
 */
export function buildWriterSectionBlockPrompt({
  metadata,
  plan,
  chapterPlan,
  sectionBlock,
  memory,
  previousSummaries,
  precedingBlockText,
}: {
  metadata: BookMetadata;
  plan?: EditorialPlan | null;
  chapterPlan: ChapterPlan;
  sectionBlock: ChapterSectionPlan;
  memory: BookBibleMemory;
  previousSummaries?: string[];
  precedingBlockText?: string;
}): PromptPackage {
  const nichePolicy = detectSensitiveNiche(metadata);
  const memoryText = formatMemoryForPrompt(memory);

  // Falls back to the client-supplied chapter digests when the BookBible memory is
  // still empty (e.g. a project restored from a backup that predates the memory).
  const previousChaptersText =
    memory.resumosCapitulos.length === 0 && previousSummaries && previousSummaries.length > 0
      ? `\n\nRESUMO DOS CAPÍTULOS ANTERIORES:\n${previousSummaries.map((s) => `- ${s}`).join('\n')}`
      : '';

  const precedingBlockTail = (precedingBlockText || '').trim();
  const continuityText = precedingBlockTail
    ? `\n\nTRECHO FINAL DO BLOCO IMEDIATAMENTE ANTERIOR DESTE MESMO CAPÍTULO (continue a partir daqui, sem repetir o que já foi dito):\n"""\n...${precedingBlockTail.slice(-PRECEDING_BLOCK_TAIL_CHARS)}\n"""`
    : '';

  const systemInstruction = `Você é um Escritor Editorial Sênior especialista na redação de obras completas em ${metadata.idioma || 'Português'}.
Sua missão é escrever o BLOCO DE CONTEÚDO ${sectionBlock.numeroBloco}: "${sectionBlock.tituloBloco}" para o CAPÍTULO ${chapterPlan.numero}: "${chapterPlan.titulo}".

DIRETRIZES DE ESTILO E TOM:
- Estilo (${metadata.estilo}): ${metadata.promptEstilo || 'Prosa límpida e fundamentada.'}
- Tom (${metadata.tom}): Mantenha ritmo envolvente e voz autoral consistente.

${nichePolicy.type !== 'none' ? `POLÍTICA PARA NICHO SENSÍVEL (${nichePolicy.type.toUpperCase()}):\n${nichePolicy.toneConstraints}\nFRASES PROIBIDAS: ${nichePolicy.forbiddenPhrases.join(', ')}` : ''}

REGRAS DE OURO DE ESCRITA:
1. Escreva em prosa contínua e rica de livro impresso.
2. Escreva EXATAMENTE em torno de ${sectionBlock.estimativaPalavras} palavras.
3. NÃO inclua saudações, introduções de IA ou observações meta-textuais. Escreva diretamente o texto do livro.
4. NÃO inclua o título do livro, cabeçalhos "Capítulo X" nem repita o título do capítulo no início do texto (o layout de diagramação insere a abertura do capítulo automaticamente).`;

  const userPrompt = `DADOS DO LIVRO E CONTEXTO:
- Título: ${metadata.titulo} (${metadata.subtitulo || ''})
- Autor: ${metadata.autor}
- Público-Alvo: ${metadata.publicoAlvo}
- Conceito Central: ${plan?.conceitoCentral || metadata.resumo}

${memoryText}${previousChaptersText}${continuityText}

INSTRUÇÕES DO BLOCO DE TRABALHO ATUAL:
- Capítulo ${chapterPlan.numero}: ${chapterPlan.titulo}
- Bloco ${sectionBlock.numeroBloco}: ${sectionBlock.tituloBloco}
- Propósito do Bloco: ${sectionBlock.proposito}
- Tópicos Obrigatórios a Aprofundar: ${sectionBlock.topicos.join(', ')}
${sectionBlock.fatosObrigatorios.length > 0 ? `- Fatos/Pontos de Destaque Exigidos: ${sectionBlock.fatosObrigatorios.join(', ')}` : ''}
${metadata.materiais ? `<materiais_usuario>\n${metadata.materiais}\n</materiais_usuario>` : ''}
${metadata.informacoesObrigatorias ? `<informacoes_obrigatorias>\n${metadata.informacoesObrigatorias}\n</informacoes_obrigatorias>` : ''}
${metadata.restricoes ? `<restricoes_usuario>\n${metadata.restricoes}\n</restricoes_usuario>` : ''}
- Meta de Palavras para este Bloco: ~${sectionBlock.estimativaPalavras} palavras

Escreva a prosa do bloco agora:`;

  return {
    taskVersion: '2.0.0-write-block',
    systemInstruction,
    userPrompt,
    jsonMode: false,
    temperature: 0.65,
  };
}

/**
 * Builds the prompt for one front/end-matter section (apresentação, introdução,
 * conclusão, exercícios, agradecimentos, or sobre-o-autor).
 *
 * BUSINESS RULE (sobreAutor): the directive text explicitly instructs the model
 * to use ONLY information the user actually provided and never invent
 * credentials, awards, or titles. This is a factual-accuracy / defamation-risk
 * guard specific to this one section type (a fabricated biography is a concrete
 * harm in a way a fabricated example in a chapter generally is not) — do not
 * remove or soften that instruction when editing `specificDirectives.sobreAutor`.
 *
 * `fullBookContent` (the already-written chapters, used so the section can
 * reference real content rather than generic platitudes) is truncated to the
 * first 15,000 characters before being interpolated — a long book's later
 * chapters are invisible to this prompt. This is a deliberate prompt-size
 * tradeoff, not a bug; if section quality for late-book content becomes an
 * issue, consider summarizing instead of raising the character cap (raising it
 * just shifts the same problem to an even longer book).
 *
 * @param metadata - Book-level config; `plan` is accepted in the parameter type
 *   for call-site compatibility but is not read by this function.
 * @param fullBookContent - Concatenated chapter text, or empty string if no
 *   chapters are written yet (falls back to a generic placeholder line).
 * @param type - Which section to write; an unrecognized value falls back to a
 *   generic "Seção Complementar" title/directive rather than throwing.
 * @returns A {@link PromptPackage} with `temperature: 0.5` and `jsonMode: false`.
 */
export function buildMatterPrompt({
  metadata,
  fullBookContent,
  type,
}: {
  metadata: BookMetadata;
  plan?: EditorialPlan | null;
  fullBookContent: string;
  type:
    'apresentacao' | 'introducao' | 'conclusao' | 'exercicios' | 'agradecimentos' | 'sobreAutor';
}): PromptPackage {
  const titles: Record<string, string> = {
    apresentacao: 'Apresentação da Obra',
    introducao: 'Introdução Oficial da Obra',
    conclusao: 'Conclusão e Encerramento',
    exercicios: 'Exercícios e Práticas',
    agradecimentos: 'Agradecimentos',
    sobreAutor: 'Sobre o Autor',
  };

  const specificDirectives: Record<string, string> = {
    apresentacao:
      'Escreva uma Apresentação elegante e convidativa para a obra, contextualizando a proposta do livro e preparando o leitor.',
    introducao:
      'Escreva uma Introdução profunda sobre a tese central da obra, abordando os conceitos fundamentais que serão desenvolvidos nos capítulos.',
    conclusao:
      'Escreva uma Conclusão transformadora, sintetizando os principais aprendizados da obra e oferecendo uma mensagem final inspiradora.',
    exercicios:
      'Crie um guia prático com Exercícios, Perguntas de Reflexão, Desafios de Aplicação e Plano de Ação Prático estruturado com base nos ensinamentos dos capítulos do livro.',
    agradecimentos:
      'Escreva uma seção de Agradecimentos calorosa, elegante e sincera, reconhecendo leitores, mentores, colaboradores e apoiadores da jornada do autor.',
    sobreAutor:
      'Escreva um perfil bibliográfico/biografia autoral do autor em tom profissional e elegante. ATENÇÃO CRÍTICA: Use EXCLUSIVAMENTE as informações reais fornecidas pelo usuário. JAMAIS invente diplomas, prêmios ou cargos fictícios.',
  };

  const title = titles[type] || 'Seção Complementar';
  const directive = specificDirectives[type] || 'Escreva o conteúdo da seção em prosa elegante.';

  const systemInstruction = `Você é um Editor Chefe Literário de alta reputação. Sua missão é redigir a seção "${title}" para um livro publicado em ${metadata.idioma || 'Português'}.
Estilo: ${metadata.estilo || 'Geral'} | Tom: ${metadata.tom || 'Conversacional e didático'}

DIRETRIZ DA SEÇÃO:
${directive}

REGRAS RÍGIDAS DE REDAÇÃO:
1. Escreva em prosa limpa de livro impresso (SEM SÍMBOLOS DE MARKDOWN TIPO '#' OU '---').
2. NÃO inclua saudações nem comentários de IA. Escreva diretamente a prosa da seção.`;

  const userPrompt = `OBRA: ${metadata.titulo} ${metadata.subtitulo ? `— ${metadata.subtitulo}` : ''}
AUTOR: ${metadata.autor}
EDITORA: ${metadata.editora || 'Editora OMNIA'}
RESUMO DO LIVRO: ${metadata.resumo}

RESUMO DO CONTEÚDO DOS CAPÍTULOS:
${fullBookContent ? fullBookContent.slice(0, 15000) : 'Obra fundamentada na proposta do autor.'}

Redija a seção "${title}" agora:`;

  return {
    taskVersion: '2.0.0-matter',
    systemInstruction,
    userPrompt,
    jsonMode: false,
    temperature: 0.5,
  };
}
