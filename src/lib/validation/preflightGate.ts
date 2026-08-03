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
  const goodScore = isReportFresh && (project.editorialReport?.notaGeral || 0) >= 70;
  items.push({
    stage: 'review',
    label: 'Auditoria e Revisão Editorial',
    passed: goodScore,
    message: goodScore
      ? `Auditoria atualizada realizada com nota ${project.editorialReport!.notaGeral}/100.`
      : hasReport && project.editorialReport?.obsoleto
        ? 'A auditoria editorial existente está obsoleta devido a edições recentes no texto.'
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
