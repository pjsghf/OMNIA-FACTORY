import { BookMetadata } from '../../../types';

export type SensitiveNicheType = 'health' | 'finance' | 'psychology' | 'none';

export interface SensitiveNichePolicy {
  type: SensitiveNicheType;
  requiresSources: boolean;
  mandatoryDisclaimer: string;
  forbiddenPhrases: string[];
  toneConstraints: string;
}

export function detectSensitiveNiche(metadata: Partial<BookMetadata>): SensitiveNichePolicy {
  const estilo = (metadata.estilo || '').toLowerCase();
  const resumo = (metadata.resumo || '').toLowerCase();
  const titulo = (metadata.titulo || '').toLowerCase();

  const combined = `${estilo} ${resumo} ${titulo}`;

  if (
    combined.includes('saude') ||
    combined.includes('bem_estar') ||
    combined.includes('medicina') ||
    combined.includes('nutricao') ||
    combined.includes('doença')
  ) {
    return {
      type: 'health',
      requiresSources: true,
      mandatoryDisclaimer:
        'Aviso: As informações contidas nesta obra possuem caráter exclusivamente educativo e informativo, não substituindo o diagnóstico, tratamento ou aconselhamento médico profissional.',
      forbiddenPhrases: ['cura garantida', 'substitui seu médico', 'refeição milagrosa', '100% eficaz'],
      toneConstraints: 'Usar tom informativo prudente. Proibido fazer diagnósticos ou promessas de cura.',
    };
  }

  if (
    combined.includes('financas') ||
    combined.includes('investimentos') ||
    combined.includes('dinheiro') ||
    combined.includes('cripto') ||
    combined.includes('trading')
  ) {
    return {
      type: 'finance',
      requiresSources: true,
      mandatoryDisclaimer:
        'Aviso: O conteúdo deste livro destina-se a fins puramente educacionais e não constitui recomendação individual de investimento nem garantia de rentabilidade.',
      forbiddenPhrases: ['lucro certo', 'fique rico rápido', 'rendimento garantido', 'sem risco'],
      toneConstraints: 'Usar tom analítico responsável. Proibido prometer ganhos financeiros garantidos.',
    };
  }

  if (
    combined.includes('psicologia') ||
    combined.includes('mente') ||
    combined.includes('terapia') ||
    combined.includes('trauma')
  ) {
    return {
      type: 'psychology',
      requiresSources: true,
      mandatoryDisclaimer:
        'Aviso: Este texto oferece reflexões conceituais e psicoeducativas, não configurando sessão de psicoterapia ou prescrição clínica.',
      forbiddenPhrases: ['elimine a depressão em 2 dias', 'substitui a terapia', 'cura do trauma'],
      toneConstraints: 'Usar tom empático e cientificamente embasado. Respeitar limites da intervenção psicológica.',
    };
  }

  return {
    type: 'none',
    requiresSources: false,
    mandatoryDisclaimer: '',
    forbiddenPhrases: [],
    toneConstraints: '',
  };
}
