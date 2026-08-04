import { BookProject, EditorialReport, ReviewFinding } from '../../../types';
import { aiOrchestrator } from '../orchestrator';
import { sanitizeEditorialReport, sanitizeReviewFinding } from './reviewSchema';

/**
 * Deterministic fingerprint of a project's reviewable content (title, author,
 * front/end matter, and every chapter's number+title+content, concatenated).
 * Same non-cryptographic rolling-hash construction as
 * `backupService.ts`'s `calculateChecksum` — see that function's doc for the
 * "not a security primitive" caveat, which applies equally here.
 *
 * Used to stamp an {@link EditorialReport} with the exact content state it
 * reviewed (`report.projectVersionHash`), so the UI can detect "this report is
 * stale, the chapters changed since it was generated" by comparing hashes
 * rather than tracking edits explicitly.
 *
 * @param project - The project to fingerprint.
 * @returns A `"hash-<number>"` string. Any change to the fields listed above
 *   changes the hash; anything NOT in that list (metadata fields other than
 *   titulo/autor, plan, chapterVersions, editorialReport itself) does not.
 */
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

/**
 * Runs the full editorial audit as a map-reduce over the book's units (front
 * matter, each chapter, end matter): one AI call analyses each unit
 * independently (MAP), then a final AI call synthesizes the per-unit findings
 * into one {@link EditorialReport} with overall scores (REDUCE).
 *
 * PARTIAL-FAILURE CONTRACT — this is the part most worth reading before calling
 * this function or changing it: a per-unit AI call failing (provider error,
 * timeout, malformed JSON) does NOT abort the whole audit; that unit is skipped,
 * its id recorded in `failedUnits`, and review continues with the remaining
 * units. Only if EVERY unit fails does this function throw. This exists
 * specifically so a report can never look like a clean pass when nothing was
 * actually reviewed: a partial failure is surfaced in the returned report via
 * `unidadesComFalha` (non-empty) and a `[AUDITORIA PARCIAL ...]` prefix
 * prepended to `resumoAvaliatorio`, and `coberturaTotalUnidadesPercent` is
 * computed from units ACTUALLY analysed, not units attempted. Callers such as
 * `preflightGate.ts` key off `unidadesComFalha` to refuse export-readiness on a
 * report that could not fully vouch for the book, regardless of `notaGeral`.
 *
 * If the REDUCE stage itself fails (separately from any MAP-stage failures),
 * this function does not throw — it falls back to a default 80/100 report
 * without global synthesis, while still returning whatever per-unit findings
 * were collected. This is a UX tradeoff (still show the operator the granular
 * findings) that {@link checkProjectPreflight}'s `>= 70` threshold happens to
 * clear; it is not validated against `unidadesComFalha` the way MAP-stage
 * failures are, since a REDUCE failure is orthogonal to per-unit coverage.
 *
 * @param project - The full project to audit. Only front matter, chapters, and
 *   end matter with non-empty trimmed content become review units; empty
 *   sections are silently skipped (not counted as failures).
 * @param aiConfig - Provider/model selection, forwarded to every unit's review
 *   call and the reduce-stage synthesis call.
 * @param onProgress - Optional callback fired before each unit review and once
 *   before the reduce stage, with a Portuguese status string and 0-100 percent.
 * @returns A sanitized {@link EditorialReport} (see `reviewSchema.ts`'s
 *   `sanitizeEditorialReport`) — always well-formed even under partial failure.
 * @throws Only when `project` has zero reviewable units, or every unit's review
 *   call failed (see the partial-failure contract above).
 */
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
  const failedUnits: string[] = [];

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
      failedUnits.push(unit.title);
    }
  }

  // A review where nothing could actually be audited must not come back looking
  // like a clean bill of health. Previously every unit could fail, the reduce step
  // could fail too, and the fallback still returned notaGeral 80 with no findings
  // -- which sails past preflightGate's >= 70 gate and clears the book to publish.
  if (failedUnits.length === totalUnits) {
    throw new Error(
      `A auditoria editorial não pôde ser realizada: todas as ${totalUnits} unidades falharam na análise da IA. Verifique a configuração do provedor e tente novamente.`
    );
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

  let finalReduceData: any;
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

  // Count only units the AI actually analysed: a unit that threw was never audited,
  // so including it inflated coverage to 100% on a partially failed run.
  const reviewedUnits = totalUnits - failedUnits.length;
  const coveragePercent = Math.min(
    100,
    Math.round((reviewedUnits / Math.max(1, totalPossibleUnits)) * 100)
  );

  const report = sanitizeEditorialReport(
    {
      ...finalReduceData,
      problemasDetectados: unitFindings,
      coberturaTotalUnidadesPercent: coveragePercent,
      projectVersionHash: versionHash,
      obsoleto: false,
      unidadesComFalha: failedUnits,
      resumoAvaliatorio:
        failedUnits.length > 0
          ? `[AUDITORIA PARCIAL — ${failedUnits.length} de ${totalUnits} unidades não puderam ser analisadas: ${failedUnits.join(', ')}] ${finalReduceData?.resumoAvaliatorio || ''}`.trim()
          : finalReduceData?.resumoAvaliatorio,
    },
    versionHash
  );

  if (onProgress) {
    onProgress('Auditoria editorial finalizada com sucesso.', 100);
  }

  return report;
}
