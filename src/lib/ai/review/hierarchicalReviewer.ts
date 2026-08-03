import { BookProject, EditorialReport, ReviewFinding } from '../../../types';
import { aiOrchestrator } from '../orchestrator';
import { sanitizeEditorialReport, sanitizeReviewFinding } from './reviewSchema';

export function computeProjectVersionHash(project: BookProject): string {
  const contentString = [
    project.metadata.titulo,
    project.metadata.autor,
    project.frontMatter.apresentacao || '',
    project.frontMatter.introducao || '',
    ...(project.chapters || []).map((c) => `${c.numero}:${c.titulo}:${c.content}`),
    project.endMatter.conclusao || '',
    project.endMatter.exercicios || '',
  ].join('|');

  let hash = 0;
  for (let i = 0; i < contentString.length; i++) {
    const char = contentString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash-${Math.abs(hash)}`;
}

export async function runHierarchicalEditorialReview({
  project,
  aiConfig,
  onProgress,
}: {
  project: BookProject;
  aiConfig?: any;
  onProgress?: (stepName: string, progressPercent: number) => void;
}): Promise<EditorialReport> {
  const versionHash = computeProjectVersionHash(project);
  const unitsToReview: Array<{
    id: string;
    title: string;
    type: 'front' | 'chapter' | 'end';
    content: string;
  }> = [];

  // Front Matter units
  if (project.frontMatter?.apresentacao?.trim()) {
    unitsToReview.push({
      id: 'front-apresentacao',
      title: 'Apresentação',
      type: 'front',
      content: project.frontMatter.apresentacao,
    });
  }
  if (project.frontMatter?.introducao?.trim()) {
    unitsToReview.push({
      id: 'front-introducao',
      title: 'Introdução',
      type: 'front',
      content: project.frontMatter.introducao,
    });
  }

  // Chapter units
  (project.chapters || []).forEach((cap) => {
    if (cap.content?.trim()) {
      unitsToReview.push({
        id: `cap-${cap.numero}`,
        title: `Capítulo ${cap.numero}: ${cap.titulo}`,
        type: 'chapter',
        content: cap.content,
      });
    }
  });

  // End Matter units
  if (project.endMatter?.conclusao?.trim()) {
    unitsToReview.push({
      id: 'end-conclusao',
      title: 'Conclusão',
      type: 'end',
      content: project.endMatter.conclusao,
    });
  }
  if (project.endMatter?.exercicios?.trim()) {
    unitsToReview.push({
      id: 'end-exercicios',
      title: 'Exercícios',
      type: 'end',
      content: project.endMatter.exercicios,
    });
  }

  const totalUnits = unitsToReview.length;
  if (totalUnits === 0) {
    throw new Error('Obra sem conteúdo para revisão. Escreva os capítulos antes de auditar.');
  }

  const unitFindings: ReviewFinding[] = [];
  const unitSummaries: Array<{ id: string; title: string; summary: string }> = [];

  // MAP STAGE: Review each unit
  for (let i = 0; i < totalUnits; i++) {
    const unit = unitsToReview[i];
    if (!unit) continue;

    if (onProgress) {
      onProgress(
        `Auditando unidade ${i + 1}/${totalUnits}: ${unit.title}`,
        Math.round(((i + 1) / (totalUnits + 1)) * 80)
      );
    }

    const systemInstruction = `Você é um Revisor Editorial Sênior. Sua função é realizar a auditoria da unidade "${unit.title}".
Analise 6 dimensões de qualidade:
1. Estrutural (lógica e tópicos)
2. Linguística (gramática e clareza)
3. Continuidade (ritmo)
4. Factual / Fontes (coerência)
5. Sensibilidade (adequação ao público)
6. Conformidade (estilo e tom)

Localize problemas específicos usando o texto fornecido.
Retorne um JSON estrito:
{
  "resumoUnidade": "resumo de 2 frases sobre a unidade",
  "achados": [
    {
      "tipo": "estrutural|linguistica|continuidade|factual|sensibilidade|conformidade",
      "severidade": "Alta|Média|Baixa",
      "descricao": "descrição do problema",
      "sugestaoDeCorrecao": "como corrigir",
      "snippet": "trecho exato do problema se houver"
    }
  ]
}`;

    const userPrompt = `LIVRO: ${project.metadata.titulo}
ESTILO: ${project.metadata.estilo} | TOM: ${project.metadata.tom}
UNIDADE: ${unit.title}

CONTEÚDO DA UNIDADE:
${unit.content}

Analise rigorosamente e retorne o JSON de auditoria.`;

    try {
      const { data } = await aiOrchestrator.generateStructured({
        systemInstruction,
        prompt: userPrompt,
        taskType: 'review',
        userMaterials: project.metadata.materiais,
        userRestrictions: project.metadata.restricoes,
        aiConfig,
      });

      const resData = data as any;
      unitSummaries.push({
        id: unit.id,
        title: unit.title,
        summary: String(resData?.resumoUnidade || 'Unidade analisada.'),
      });

      const rawAchados = Array.isArray(resData?.achados) ? resData.achados : [];
      rawAchados.forEach((raw: any) => {
        let start: number | undefined;
        let end: number | undefined;
        if (raw.snippet && typeof raw.snippet === 'string') {
          const idx = unit.content.indexOf(raw.snippet);
          if (idx !== -1) {
            start = idx;
            end = idx + raw.snippet.length;
          }
        }

        unitFindings.push(
          sanitizeReviewFinding(
            {
              ...raw,
              unitId: unit.id,
              unitTitle: unit.title,
              versionId: versionHash,
              start,
              end,
            },
            unit.id,
            versionHash
          )
        );
      });
    } catch (err) {
      console.warn(`Aviso: falha na revisão unitária de ${unit.title}`, err);
    }
  }

  // REDUCE STAGE: Synthesize overall report
  if (onProgress) {
    onProgress('Sintetizando auditoria editorial da obra completa...', 90);
  }

  const reduceSystemInstruction = `Você é o Diretor Editorial Chefe responsável pelo laudo final da obra.
Sua missão é consolidar a auditoria realizada em todas as ${totalUnits} unidades da obra e atribuir pontuações por modalidade (0 a 100).

REGRAS:
1. Avalie as 6 modalidades: 'estrutural', 'linguistica', 'continuidade', 'factual', 'sensibilidade', 'conformidade'.
2. Calcule a notaGeral ponderada (0 a 100).
3. Apresente os pontos fortes da obra e o parecer geral.
4. Retorne JSON estrito:
{
  "notaGeral": 88,
  "resumoAvaliatorio": "parecer detalhado sobre a obra inteira",
  "modalidades": [
    { "categoria": "estrutural", "nota": 90, "resumo": "..." },
    { "categoria": "linguistica", "nota": 85, "resumo": "..." },
    { "categoria": "continuidade", "nota": 88, "resumo": "..." },
    { "categoria": "factual", "nota": 92, "resumo": "..." },
    { "categoria": "sensibilidade", "nota": 95, "resumo": "..." },
    { "categoria": "conformidade", "nota": 87, "resumo": "..." }
  ],
  "pontosFortes": ["ponto 1", "ponto 2"],
  "sugestoesGlobais": ["sugestão global 1", "sugestão global 2"]
}`;

  const reduceUserPrompt = `LIVRO: ${project.metadata.titulo} (${project.metadata.autor})
PUBLICO-ALVO: ${project.metadata.publicoAlvo}

RESUMO DAS UNIDADES AUDITADAS:
${unitSummaries.map((s) => `- [${s.title}]: ${s.summary}`).join('\n')}

PROBLEMAS IDENTIFICADOS NAS UNIDADES (${unitFindings.length}):
${unitFindings.map((f) => `- [${f.unitTitle} - ${f.tipo} - ${f.severidade}]: ${f.descricao}`).join('\n')}

Gere a síntese global da auditoria em JSON.`;

  let finalReduceData: any = {};
  try {
    const { data } = await aiOrchestrator.generateStructured({
      systemInstruction: reduceSystemInstruction,
      prompt: reduceUserPrompt,
      taskType: 'review',
      userMaterials: project.metadata.materiais,
      userRestrictions: project.metadata.restricoes,
      aiConfig,
    });
    finalReduceData = data;
  } catch (err) {
    console.error('Erro na síntese global da auditoria:', err);
    finalReduceData = {
      notaGeral: 80,
      resumoAvaliatorio: 'Auditoria concluída por unidades com ressalvas de síntese.',
    };
  }

  const totalPossibleUnits =
    (project.chapters?.length || 1) +
    (project.frontMatter?.apresentacao ? 1 : 0) +
    (project.frontMatter?.introducao ? 1 : 0) +
    (project.endMatter?.conclusao ? 1 : 0) +
    (project.endMatter?.exercicios ? 1 : 0);
  const coveragePercent = Math.min(
    100,
    Math.round((unitsToReview.length / Math.max(1, totalPossibleUnits)) * 100)
  );

  const report = sanitizeEditorialReport(
    {
      ...finalReduceData,
      problemasDetectados: unitFindings,
      coberturaTotalUnidadesPercent: coveragePercent,
      projectVersionHash: versionHash,
      obsoleto: false,
    },
    versionHash
  );

  if (onProgress) {
    onProgress('Auditoria editorial finalizada com sucesso.', 100);
  }

  return report;
}
