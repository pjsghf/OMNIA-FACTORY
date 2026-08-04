import { BookProject, EditorialStage } from '../../types';
import { validateBookConfig } from '../ai/validation/configValidator';

export interface PreflightItem {
  stage: EditorialStage;
  label: string;
  passed: boolean;
  message: string;
  targetStage: EditorialStage;
}

export interface PreflightCheckResult {
  readyToPublish: boolean;
  score: number;
  items: PreflightItem[];
}

/**
 * Computes publish-readiness across the 5 editorial stages (config, planning,
 * writing, review, export), for the "ready to export" indicator in the UI.
 *
 * BUSINESS RULE (review gate): stage 4 only `passed: true` when the editorial
 * report is fresh (`!obsoleto`), fully analysed (`unidadesComFalha` is empty —
 * see {@link runHierarchicalEditorialReview} in `hierarchicalReviewer.ts`, which
 * is what populates that field on a partial-failure audit), AND scores ≥ 70.
 * A partial or stale audit cannot satisfy this stage even with a high
 * `notaGeral`, by design: the score only means something once every unit was
 * actually reviewed.
 *
 * Read-only / pure: does not mutate `project`, has no side effects, safe to call
 * on every render.
 *
 * @param project - The active project, or `null` if none is selected/loaded.
 * @returns `readyToPublish` (true only if every stage passed), a 0-100 `score`
 *   (percentage of stages passed — NOT a quality score, just stage completion),
 *   and per-stage `items` with a human-readable Portuguese `message` suitable
 *   for direct display plus a `targetStage` for a "go fix this" navigation link.
 */
export function checkProjectPreflight(project: BookProject | null): PreflightCheckResult {
  if (!project) {
    return {
      readyToPublish: false,
      score: 0,
      items: [
        {
          stage: 'config',
          label: 'Projeto Ativo',
          passed: false,
          message: 'Nenhum projeto ativo selecionado.',
          targetStage: 'config',
        },
      ],
    };
  }

  const items: PreflightItem[] = [];

  // 1. Config Check
  const configVal = validateBookConfig(project.metadata || {});
  items.push({
    stage: 'config',
    label: 'Configuração e Metadados do Livro',
    passed: configVal.valid,
    message: configVal.valid
      ? 'Metadados básicos válidos (Título, Autor, Capítulos, Limites).'
      : `Metadados incompletos ou inválidos: ${Object.values(configVal.errors).join('; ')}`,
    targetStage: 'config',
  });

  // 2. Planning Check
  const hasPlan = Boolean(
    project.plan && Array.isArray(project.plan.sumario) && project.plan.sumario.length > 0
  );
  const planMatch =
    hasPlan && project.plan!.sumario.length === (project.metadata.qtdCapitulos || 7);
  items.push({
    stage: 'planning',
    label: 'Plano Editorial e Sumário',
    passed: planMatch,
    message: planMatch
      ? `Plano editorial completo com ${project.plan!.sumario.length} capítulos.`
      : hasPlan
        ? `Plano editorial divergente (${project.plan!.sumario.length} caps vs ${project.metadata.qtdCapitulos} solicitados).`
        : 'Plano editorial não gerado ou sem sumário.',
    targetStage: 'planning',
  });

  // 3. Writing Check
  const totalCaps = project.chapters?.length || 0;
  const completedCaps = (project.chapters || []).filter(
    (c) => c.status === 'completed' || c.status === 'edited'
  ).length;
  const allWritten = totalCaps > 0 && completedCaps === totalCaps;
  items.push({
    stage: 'writing',
    label: 'Redação dos Capítulos',
    passed: allWritten,
    message: allWritten
      ? `Todos os ${totalCaps} capítulos redigidos com sucesso.`
      : totalCaps > 0
        ? `${completedCaps} de ${totalCaps} capítulos redigidos.`
        : 'Nenhum capítulo foi redigido ainda.',
    targetStage: 'writing',
  });

  // 4. Review Check
  const hasReport = Boolean(project.editorialReport);
  const isReportFresh = hasReport && !project.editorialReport?.obsoleto;
  const failedUnits = project.editorialReport?.unidadesComFalha || [];
  // A partial audit cannot vouch for the book: the score only reflects the units
  // that were actually analysed.
  const isComplete = failedUnits.length === 0;
  const goodScore = isReportFresh && isComplete && (project.editorialReport?.notaGeral || 0) >= 70;
  items.push({
    stage: 'review',
    label: 'Auditoria e Revisão Editorial',
    passed: goodScore,
    message: goodScore
      ? `Auditoria atualizada realizada com nota ${project.editorialReport!.notaGeral}/100.`
      : hasReport && project.editorialReport?.obsoleto
        ? 'A auditoria editorial existente está obsoleta devido a edições recentes no texto.'
        : hasReport && !isComplete
          ? `Auditoria incompleta: ${failedUnits.length} unidade(s) não puderam ser analisadas (${failedUnits.join(', ')}). Execute a auditoria novamente.`
          : hasReport
            ? `Auditoria realizada com nota baixa (${project.editorialReport!.notaGeral}/100). Aplique melhorias.`
            : 'Auditoria editorial não realizada.',
    targetStage: 'review',
  });

  // 5. Export Readiness
  const exportReady = configVal.valid && allWritten && hasReport;
  items.push({
    stage: 'design_export',
    label: 'Pronto para Exportação e Diagramação',
    passed: exportReady,
    message: exportReady
      ? 'A obra cumpre todos os critérios técnicos para exportação em PDF, EPUB e HTML.'
      : 'Complete as etapas de redação e auditoria antes de exportar.',
    targetStage: 'design_export',
  });

  const passedCount = items.filter((i) => i.passed).length;
  const score = Math.round((passedCount / items.length) * 100);
  const readyToPublish = items.every((i) => i.passed);

  return {
    readyToPublish,
    score,
    items,
  };
}
