import { EditorialPlan, ChapterPlan, BookMetadata } from '../../../types';

export interface PlanReconciliationResult {
  success: boolean;
  reconciledPlan: EditorialPlan;
  adjustmentsMade: string[];
}

export function reconcileEditorialPlan(
  rawPlan: any,
  metadata: BookMetadata
): PlanReconciliationResult {
  const adjustmentsMade: string[] = [];
  const targetCount = metadata.qtdCapitulos || 7;

  const conceitoCentral =
    typeof rawPlan?.conceitoCentral === 'string' && rawPlan.conceitoCentral.trim().length > 0
      ? rawPlan.conceitoCentral.trim()
      : metadata.resumo;

  const promessaPrincipal =
    typeof rawPlan?.promessaPrincipal === 'string' && rawPlan.promessaPrincipal.trim().length > 0
      ? rawPlan.promessaPrincipal.trim()
      : metadata.subtitulo || metadata.resumo;

  const perfilLeitor = {
    descricao:
      rawPlan?.perfilLeitor?.descricao ||
      `Leitores interessados no público-alvo: ${metadata.publicoAlvo}`,
    doresEAnseios: Array.isArray(rawPlan?.perfilLeitor?.doresEAnseios)
      ? rawPlan.perfilLeitor.doresEAnseios.map(String)
      : ['Buscar conhecimento e transformação'],
    oQueBuscaraNoLivro: Array.isArray(rawPlan?.perfilLeitor?.oQueBuscaraNoLivro)
      ? rawPlan.perfilLeitor.oQueBuscaraNoLivro.map(String)
      : ['Respostas práticas e fundamentadas'],
  };

  const rawChapters: any[] = Array.isArray(rawPlan?.sumario) ? rawPlan.sumario : [];

  // If chapter count does not match target, adjust deterministically
  if (rawChapters.length !== targetCount) {
    adjustmentsMade.push(
      `Quantidade de capítulos ajustada de ${rawChapters.length} para o número solicitado (${targetCount}).`
    );
  }

  const targetWordEstimate = Math.round((metadata.minPalavras + metadata.maxPalavras) / 2);

  const sumario: ChapterPlan[] = [];

  for (let i = 0; i < targetCount; i++) {
    const rawCap = rawChapters[i] || {};
    const numero = i + 1;

    const titulo =
      typeof rawCap.titulo === 'string' && rawCap.titulo.trim().length > 0
        ? rawCap.titulo.replace(/^[#*\d.\s]+/g, '').trim()
        : `Capítulo ${numero}: ${metadata.titulo} - Parte ${numero}`;

    const subtitulo = typeof rawCap.subtitulo === 'string' ? rawCap.subtitulo.trim() : '';

    const objetivo =
      typeof rawCap.objetivo === 'string' && rawCap.objetivo.trim().length > 0
        ? rawCap.objetivo.trim()
        : `Desenvolver os fundamentos e aplicações do capítulo ${numero}.`;

    const topicos =
      Array.isArray(rawCap.topicos) && rawCap.topicos.length > 0
        ? rawCap.topicos.map(String)
        : [
            'Apresentação dos conceitos chave',
            'Exemplos e análises práticas',
            'Conclusões e síntese',
          ];

    const subtopicos = Array.isArray(rawCap.subtopicos)
      ? rawCap.subtopicos.map(String)
      : ['Detalhamento inicial', 'Casos de estudo'];

    let estimativaPalavras = Number(rawCap.estimativaPalavras) || targetWordEstimate;
    if (estimativaPalavras < metadata.minPalavras || estimativaPalavras > metadata.maxPalavras) {
      estimativaPalavras = targetWordEstimate;
    }

    sumario.push({
      numero,
      titulo,
      subtitulo,
      objetivo,
      topicos,
      subtopicos,
      estimativaPalavras,
    });
  }

  const reconciledPlan: EditorialPlan = {
    conceitoCentral,
    promessaPrincipal,
    perfilLeitor,
    sumario,
  };

  return {
    success: true,
    reconciledPlan,
    adjustmentsMade,
  };
}
