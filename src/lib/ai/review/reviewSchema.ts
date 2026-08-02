import { EditorialReport, ReviewFinding, ReviewModalityScore } from '../../../types';

export function sanitizeReviewFinding(raw: any, defaultUnitId = 'obra', defaultVersionId = 'v1'): ReviewFinding {
  const validTypes = ['estrutural', 'linguistica', 'continuidade', 'factual', 'sensibilidade', 'conformidade'] as const;
  const rawTipo = String(raw?.tipo || '').toLowerCase();
  
  let tipo: ReviewFinding['tipo'] = 'linguistica';
  if (rawTipo.includes('estru') || rawTipo.includes('estrutural')) tipo = 'estrutural';
  else if (rawTipo.includes('ling') || rawTipo.includes('gramat') || rawTipo.includes('ortog')) tipo = 'linguistica';
  else if (rawTipo.includes('contin') || rawTipo.includes('transic')) tipo = 'continuidade';
  else if (rawTipo.includes('fact') || rawTipo.includes('fonte') || rawTipo.includes('dado')) tipo = 'factual';
  else if (rawTipo.includes('sensib') || rawTipo.includes('ofens')) tipo = 'sensibilidade';
  else if (rawTipo.includes('conform') || rawTipo.includes('estilo') || rawTipo.includes('tom')) tipo = 'conformidade';

  const validSeverities = ['Alta', 'Média', 'Baixa'] as const;
  let severidade: ReviewFinding['severidade'] = 'Baixa';
  const rawSev = String(raw?.severidade || '').toLowerCase();
  if (rawSev.includes('alt') || rawSev.includes('high')) severidade = 'Alta';
  else if (rawSev.includes('med') || rawSev.includes('méd')) severidade = 'Média';

  const unitId = String(raw?.unitId || raw?.chapterId || defaultUnitId);
  const versionId = String(raw?.versionId || defaultVersionId);

  return {
    id: String(raw?.id || `finding-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    unitId,
    unitTitle: String(raw?.unitTitle || raw?.localizacao || 'Capítulo / Seção'),
    versionId,
    start: typeof raw?.start === 'number' ? raw.start : undefined,
    end: typeof raw?.end === 'number' ? raw.end : undefined,
    snippet: raw?.snippet ? String(raw.snippet) : undefined,
    tipo,
    severidade,
    descricao: String(raw?.descricao || raw?.explicacao || 'Item auditado pela revisão.').trim(),
    sugestaoDeCorrecao: String(raw?.sugestaoDeCorrecao || raw?.sugestoesDeCorrecao || raw?.sugestao || 'Revisar trecho conforme recomendação.').trim(),
    status: raw?.status === 'applied' || raw?.status === 'rejected' ? raw.status : 'pending',
  };
}

export function sanitizeEditorialReport(raw: any, projectVersionHash = ''): EditorialReport {
  const notaGeral = Math.min(100, Math.max(0, Math.round(Number(raw?.notaGeral || 80))));

  const modalidadesRaw = Array.isArray(raw?.modalidades) ? raw.modalidades : [];
  const defaultModalidades: ReviewModalityScore[] = [
    { categoria: 'estrutural', nota: notaGeral, resumo: 'Estrutura lógica e divisão de tópicos.' },
    { categoria: 'linguistica', nota: notaGeral, resumo: 'Gramática, ortografia e estilo.' },
    { categoria: 'continuidade', nota: notaGeral, resumo: 'Fluidez das transições entre capítulos.' },
    { categoria: 'factual', nota: notaGeral, resumo: 'Coerência interna e referências.' },
    { categoria: 'sensibilidade', nota: notaGeral, resumo: 'Adequação ao público-alvo.' },
    { categoria: 'conformidade', nota: notaGeral, resumo: 'Aderência ao estilo e tom solicitados.' },
  ];

  const modalidades: ReviewModalityScore[] = defaultModalidades.map((def) => {
    const found = modalidadesRaw.find((m: any) => String(m?.categoria).toLowerCase().includes(def.categoria));
    if (found) {
      return {
        categoria: def.categoria,
        nota: Math.min(100, Math.max(0, Math.round(Number(found.nota || notaGeral)))),
        resumo: String(found.resumo || def.resumo),
      };
    }
    return def;
  });

  const rawFindings = Array.isArray(raw?.problemasDetectados)
    ? raw.problemasDetectados
    : Array.isArray(raw?.achados)
    ? raw.achados
    : [];

  const problemasDetectados = rawFindings.map((f: any) => sanitizeReviewFinding(f));

  return {
    id: String(raw?.id || `report-${Date.now()}`),
    createdAt: raw?.createdAt || new Date().toISOString(),
    projectVersionHash: raw?.projectVersionHash || projectVersionHash,
    notaGeral,
    resumoAvaliatorio: String(raw?.resumoAvaliatorio || 'Análise de auditoria editorial concluída.').trim(),
    modalidades,
    pontosFortes: Array.isArray(raw?.pontosFortes) ? raw.pontosFortes.map(String) : ['Boa estrutura narrativa.'],
    problemasDetectados,
    sugestoesGlobais: Array.isArray(raw?.sugestoesGlobais) ? raw.sugestoesGlobais.map(String) : ['Continuar o polimento.'],
    coberturaTotalUnidadesPercent: Math.min(100, Math.max(0, Number(raw?.coberturaTotalUnidadesPercent || 100))),
    obsoleto: Boolean(raw?.obsoleto),
  };
}
