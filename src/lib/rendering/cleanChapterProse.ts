/**
 * Cleans chapter prose by stripping redundant leading chapter number and title headings.
 * Prevents double-rendering of "CAPÍTULO X" and chapter titles in PDF, EPUB, and Immersive Reader.
 */
export function cleanChapterProse(
  rawContent: string,
  chapterNumber?: number,
  chapterTitle?: string
): string {
  if (!rawContent || typeof rawContent !== 'string') return '';

  let text = rawContent.trim();

  const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  let modified = true;
  let safetyCounter = 0;

  while (modified && safetyCounter < 10) {
    modified = false;
    safetyCounter++;

    // Remove leading dividers or empty lines
    text = text.replace(/^[\s\r\n─*_-]+/, '');

    const lines = text.split(/\r?\n/);
    if (lines.length === 0) break;

    const firstLine = (lines[0] ?? '').trim();
    if (!firstLine) {
      lines.shift();
      text = lines.join('\n').trim();
      modified = true;
      continue;
    }

    // Pattern 1: "Capítulo X" / "CAPÍTULO X" / "Cap. X" with optional colon/dash and title
    const capNumRegex = /^(?:#+\s*)?(?:capítulo|capitulo|cap\.)\s*\d+\b(?:\s*[:–—-]\s*.*)?$/i;

    // Pattern 2: Matching exact chapter title
    let titleRegex: RegExp | null = null;
    if (chapterTitle && chapterTitle.trim()) {
      const cleanTitle = chapterTitle.trim();
      titleRegex = new RegExp(`^(?:#+\\s*)?${escapeRegExp(cleanTitle)}$`, 'i');
    }

    if (capNumRegex.test(firstLine) || (titleRegex && titleRegex.test(firstLine))) {
      lines.shift();
      text = lines.join('\n').trim();
      modified = true;
      continue;
    }

    // Pattern 3: Chapter number specific match if chapterNumber is provided
    if (chapterNumber !== undefined) {
      const combinedCapNumRegex = new RegExp(
        `^(?:#+\\s*)?(?:capítulo|capitulo|cap\\.)\\s*${chapterNumber}\\b.*$`,
        'i'
      );
      if (combinedCapNumRegex.test(firstLine)) {
        lines.shift();
        text = lines.join('\n').trim();
        modified = true;
        continue;
      }
    }
  }

  return text.trim();
}
