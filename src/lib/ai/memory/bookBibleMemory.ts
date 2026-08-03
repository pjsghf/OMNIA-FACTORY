export interface ChapterMemoryEntry {
  chapterNumber: number;
  title: string;
  summary: string;
  keyTheses: string[];
  termsDefined: string[];
  analogiesUsed: string[];
}

export interface BookBibleMemory {
  version: number;
  updatedAt: string;
  resumosCapitulos: ChapterMemoryEntry[];
  afirmacoesChave: string[];
  personagensOuPessoas: string[];
  datasETermos: string[];
  exemplosEAnalogiasUtilizados: string[];
  promessasEPendencias: string[];
  riscosDeRepeticao: string[];
}

export function createInitialBookBibleMemory(): BookBibleMemory {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    resumosCapitulos: [],
    afirmacoesChave: [],
    personagensOuPessoas: [],
    datasETermos: [],
    exemplosEAnalogiasUtilizados: [],
    promessasEPendencias: [],
    riscosDeRepeticao: [],
  };
}

export function updateBookBibleMemoryWithChapter(
  memory: BookBibleMemory,
  chapterNumber: number,
  title: string,
  chapterContent: string,
  extractedSummary?: Partial<ChapterMemoryEntry>
): BookBibleMemory {
  const summaryText =
    extractedSummary?.summary ||
    (chapterContent
      ? chapterContent.slice(0, 300) + '...'
      : `Capítulo ${chapterNumber} concluído.`);

  const newEntry: ChapterMemoryEntry = {
    chapterNumber,
    title,
    summary: summaryText,
    keyTheses: extractedSummary?.keyTheses || [],
    termsDefined: extractedSummary?.termsDefined || [],
    analogiesUsed: extractedSummary?.analogiesUsed || [],
  };

  const updatedChapters = [
    ...memory.resumosCapitulos.filter((c) => c.chapterNumber !== chapterNumber),
    newEntry,
  ].sort((a, b) => a.chapterNumber - b.chapterNumber);

  return {
    ...memory,
    version: memory.version + 1,
    updatedAt: new Date().toISOString(),
    resumosCapitulos: updatedChapters,
    afirmacoesChave: Array.from(
      new Set([...memory.afirmacoesChave, ...(extractedSummary?.keyTheses || [])])
    ),
    datasETermos: Array.from(
      new Set([...memory.datasETermos, ...(extractedSummary?.termsDefined || [])])
    ),
    exemplosEAnalogiasUtilizados: Array.from(
      new Set([...memory.exemplosEAnalogiasUtilizados, ...(extractedSummary?.analogiesUsed || [])])
    ),
  };
}

export function formatMemoryForPrompt(memory: BookBibleMemory): string {
  if (!memory || memory.resumosCapitulos.length === 0) {
    return 'MEMÓRIA EDITORIAL: Nenhum capítulo anterior redigido (Primeiro capítulo).';
  }

  const summaries = memory.resumosCapitulos
    .map((c) => `- Capítulo ${c.chapterNumber} ("${c.title}"): ${c.summary}`)
    .join('\n');

  const terms =
    memory.datasETermos.length > 0
      ? `\n\nTERMOS JÁ DEFINIDOS: ${memory.datasETermos.join(', ')}`
      : '';
  const analogies =
    memory.exemplosEAnalogiasUtilizados.length > 0
      ? `\n\nANALOGIAS E EXEMPLOS JÁ UTILIZADOS (NÃO REPETIR): ${memory.exemplosEAnalogiasUtilizados.join('; ')}`
      : '';

  return `MEMÓRIA EDITORIAL E CONTINUIDADE (CAPÍTULOS ANTERIORES):\n${summaries}${terms}${analogies}`;
}
