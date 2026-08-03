import { BookMetadata } from '../../../types';

export type SensitiveNicheType = 'health' | 'finance' | 'psychology' | 'none';

export interface SensitiveNichePolicy {
  type: SensitiveNicheType;
  requiresSources: boolean;
  mandatoryDisclaimer: string;
  forbiddenPhrases: string[];
  toneConstraints: string;
}

/**
 * Strips diacritics so the unaccented keywords below match real Portuguese text.
 * The style slugs ("saude_bem_estar") are already unaccented, but a resumo or
 * titulo naturally contains "saúde", "finanças", "psicologia" -- none of which
 * matched, so the sensitive-niche policy never triggered from free-text fields.
 */
function foldAccents(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function detectSensitiveNiche(metadata: Partial<BookMetadata>): SensitiveNichePolicy {
  const estilo = foldAccents(metadata.estilo || '');
  const resumo = foldAccents(metadata.resumo || '');
  const titulo = foldAccents(metadata.titulo || '');

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
      forbiddenPhrases: [
        'cura garantida',
        'substitui seu médico',
        'refeição milagrosa',
        '100% eficaz',
      ],
      toneConstraints:
        'Usar tom informativo prudente. Proibido fazer diagnósticos ou promessas de cura.',
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
      toneConstraints:
        'Usar tom analítico responsável. Proibido prometer ganhos financeiros garantidos.',
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
      toneConstraints:
        'Usar tom empático e cientificamente embasado. Respeitar limites da intervenção psicológica.',
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
