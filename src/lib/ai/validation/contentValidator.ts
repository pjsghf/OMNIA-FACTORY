export interface ContentValidationResult {
  valid: boolean;
  wordCount: number;
  wordRatio: number;
  isEmpty: boolean;
  isTruncated: boolean;
  languageMatch: boolean;
  issues: string[];
}

export function countWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  // Clean markdown formatting characters before counting words
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#\*\-_=~`]/g, ' ')
    .trim();

  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter((w) => w.length > 0).length;
}

export function validateChapterContent(
  content: string,
  targetWordCount: number,
  expectedLanguage = 'pt-BR'
): ContentValidationResult {
  const issues: string[] = [];
  const trimmed = (content || '').trim();

  const isEmpty = trimmed.length === 0;
  if (isEmpty) {
    issues.push('O conteúdo retornado pela IA está completamente vazio.');
  }

  const wordCount = countWords(trimmed);
  const wordRatio = targetWordCount > 0 ? wordCount / targetWordCount : 1.0;

  if (!isEmpty && wordRatio < 0.65) {
    issues.push(
      `Volume de palavras insuficiente: geradas ${wordCount} palavras contra a meta de ${targetWordCount} (cobertura: ${(
        wordRatio * 100
      ).toFixed(1)}%).`
    );
  }

  // Check abrupt truncation (ends mid-word or without end punctuation)
  let isTruncated = false;
  if (!isEmpty && trimmed.length > 100) {
    const lastChar = trimmed.slice(-1);
    const validEndChars = ['.', '!', '?', '"', '”', '`', ')', '}', '\n'];
    if (!validEndChars.includes(lastChar)) {
      isTruncated = true;
      issues.push('O texto aparenta ter sido truncado antes de concluir a frase final.');
    }
  }

  // Basic Portuguese detection test
  let languageMatch = true;
  if (expectedLanguage.startsWith('pt') && !isEmpty) {
    const ptMarkers = [' que ', ' para ', ' com ', ' como ', ' este ', ' esta ', ' não ', ' do ', ' da '];
    const lower = trimmed.toLowerCase();
    const matchCount = ptMarkers.filter((m) => lower.includes(m)).length;
    if (matchCount < 2 && wordCount > 50) {
      languageMatch = false;
      issues.push('O idioma do texto gerado pode não corresponder ao Português solicitado.');
    }
  }

  const valid = !isEmpty && wordRatio >= 0.65 && !isTruncated && languageMatch;

  return {
    valid,
    wordCount,
    wordRatio,
    isEmpty,
    isTruncated,
    languageMatch,
    issues,
  };
}
