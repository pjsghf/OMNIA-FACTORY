export interface LanguageInfo {
  code: string; // e.g. 'pt-br', 'pt-pt', 'en-us', 'en-uk'
  bcp47: string; // e.g. 'pt-BR', 'pt-PT', 'en-US', 'en-GB'
  name: string; // e.g. 'Português (Brasil)'
  region: string; // e.g. 'Américas' | 'Europa'
  countryCode: string; // e.g. 'pt-br'
  displayTag: string; // e.g. 'pt-br'
}

/**
 * Normalizes any language input string or BCP-47 tag into standardized country-locale language info.
 */
export function getLanguageInfo(langInput?: string): LanguageInfo {
  if (!langInput) {
    return {
      code: 'pt-br',
      bcp47: 'pt-BR',
      name: 'Português (Brasil)',
      region: 'Américas',
      countryCode: 'pt-br',
      displayTag: 'pt-br',
    };
  }

  const lower = langInput.toLowerCase().trim();

  if (lower.includes('pt-pt') || lower.includes('portugal')) {
    return {
      code: 'pt-pt',
      bcp47: 'pt-PT',
      name: 'Português (Portugal)',
      region: 'Europa',
      countryCode: 'pt-pt',
      displayTag: 'pt-pt',
    };
  }
  if (
    lower.includes('pt-br') ||
    lower.includes('brasil') ||
    lower.includes('brazil') ||
    lower === 'pt' ||
    lower.includes('portug')
  ) {
    return {
      code: 'pt-br',
      bcp47: 'pt-BR',
      name: 'Português (Brasil)',
      region: 'Américas',
      countryCode: 'pt-br',
      displayTag: 'pt-br',
    };
  }
  if (
    lower.includes('en-gb') ||
    lower.includes('en-uk') ||
    lower.includes('reino unido') ||
    lower.includes('uk') ||
    lower.includes('england')
  ) {
    return {
      code: 'en-uk',
      bcp47: 'en-GB',
      name: 'Inglês (Reino Unido)',
      region: 'Europa',
      countryCode: 'en-uk',
      displayTag: 'en-uk',
    };
  }
  if (
    lower.includes('en-us') ||
    lower.includes('estados unidos') ||
    lower.includes('eua') ||
    lower === 'en' ||
    lower.includes('ingl')
  ) {
    return {
      code: 'en-us',
      bcp47: 'en-US',
      name: 'Inglês (Estados Unidos)',
      region: 'Américas',
      countryCode: 'en-us',
      displayTag: 'en-us',
    };
  }
  if (lower.includes('es-es') || lower.includes('espanha')) {
    return {
      code: 'es-es',
      bcp47: 'es-ES',
      name: 'Espanhol (Espanha)',
      region: 'Europa',
      countryCode: 'es-es',
      displayTag: 'es-es',
    };
  }
  if (
    lower.includes('es-mx') ||
    lower.includes('méxico') ||
    lower.includes('américa latina') ||
    lower === 'es' ||
    lower.includes('espanh')
  ) {
    return {
      code: 'es-mx',
      bcp47: 'es-MX',
      name: 'Espanhol (América Latina / México)',
      region: 'Américas',
      countryCode: 'es-mx',
      displayTag: 'es-mx',
    };
  }
  if (lower.includes('fr-ca') || lower.includes('canadá') || lower.includes('quebec')) {
    return {
      code: 'fr-ca',
      bcp47: 'fr-CA',
      name: 'Francês (Canadá)',
      region: 'Américas',
      countryCode: 'fr-ca',
      displayTag: 'fr-ca',
    };
  }
  if (
    lower.includes('fr-fr') ||
    lower.includes('frança') ||
    lower === 'fr' ||
    lower.includes('franc')
  ) {
    return {
      code: 'fr-fr',
      bcp47: 'fr-FR',
      name: 'Francês (França)',
      region: 'Europa',
      countryCode: 'fr-fr',
      displayTag: 'fr-fr',
    };
  }
  if (
    lower.includes('de-de') ||
    lower.includes('alemanha') ||
    lower === 'de' ||
    lower.includes('alem')
  ) {
    return {
      code: 'de-de',
      bcp47: 'de-DE',
      name: 'Alemão (Alemanha)',
      region: 'Europa',
      countryCode: 'de-de',
      displayTag: 'de-de',
    };
  }
  if (
    lower.includes('it-it') ||
    lower.includes('itália') ||
    lower === 'it' ||
    lower.includes('ital')
  ) {
    return {
      code: 'it-it',
      bcp47: 'it-IT',
      name: 'Italiano (Itália)',
      region: 'Europa',
      countryCode: 'it-it',
      displayTag: 'it-it',
    };
  }

  const match = lower.match(/^([a-z]{2})[-_]([a-z]{2})$/);
  if (match) {
    const formatted = `${match[1]}-${match[2]}`;
    return {
      code: formatted,
      bcp47: `${match[1].toLowerCase()}-${match[2].toUpperCase()}`,
      name: langInput,
      region: 'Internacional',
      countryCode: formatted,
      displayTag: formatted,
    };
  }

  const fallbackCode = lower.slice(0, 5).replace('_', '-');
  return {
    code: fallbackCode,
    bcp47: fallbackCode,
    name: langInput,
    region: 'Internacional',
    countryCode: fallbackCode,
    displayTag: fallbackCode,
  };
}
