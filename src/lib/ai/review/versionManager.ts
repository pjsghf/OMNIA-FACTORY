export interface ChapterVersionItem {
  id: string;
  chapterNumber: number;
  versionNumber: number;
  createdAt: string;
  author: 'ia' | 'user' | 'review_patch';
  label?: string;
  content: string;
  wordCount: number;
}

export interface WordDiffChunk {
  type: 'unchanged' | 'added' | 'removed';
  value: string;
}

export function computeWordDiff(oldText: string, newText: string): WordDiffChunk[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  const result: WordDiffChunk[] = [];
  let i = 0;
  let j = 0;

  while (i < oldWords.length && j < newWords.length) {
    const oldW = oldWords[i];
    const newW = newWords[j];

    if (oldW !== undefined && newW !== undefined && oldW === newW) {
      result.push({ type: 'unchanged', value: oldW });
      i++;
      j++;
    } else {
      // Lookahead for match
      let matchIdxNew = -1;
      let matchIdxOld = -1;

      for (let k = j + 1; k < Math.min(j + 10, newWords.length); k++) {
        if (newWords[k] === oldW) {
          matchIdxNew = k;
          break;
        }
      }

      for (let k = i + 1; k < Math.min(i + 10, oldWords.length); k++) {
        if (oldWords[k] === newW) {
          matchIdxOld = k;
          break;
        }
      }

      if (matchIdxNew !== -1) {
        while (j < matchIdxNew) {
          if (newWords[j] !== undefined) {
            result.push({ type: 'added', value: newWords[j]! });
          }
          j++;
        }
      } else if (matchIdxOld !== -1) {
        while (i < matchIdxOld) {
          if (oldWords[i] !== undefined) {
            result.push({ type: 'removed', value: oldWords[i]! });
          }
          i++;
        }
      } else {
        if (oldW !== undefined) result.push({ type: 'removed', value: oldW });
        if (newW !== undefined) result.push({ type: 'added', value: newW });
        i++;
        j++;
      }
    }
  }

  while (i < oldWords.length) {
    const oldW = oldWords[i];
    if (oldW !== undefined) {
      result.push({ type: 'removed', value: oldW });
    }
    i++;
  }

  while (j < newWords.length) {
    const newW = newWords[j];
    if (newW !== undefined) {
      result.push({ type: 'added', value: newW });
    }
    j++;
  }

  return result;
}

/**
 * Creates the next version entry for a chapter.
 *
 * `existingVersions` is what makes the numbering real: without it every entry was
 * stamped versionNumber: 1, so the history panel showed a stack of "Versão 1".
 * (A correct createNewChapterVersion existed alongside this one but was never
 * imported anywhere; the two have been merged.)
 */
export function createChapterVersion({
  chapterNumber,
  content,
  existingVersions = [],
  author = 'ia',
  label,
}: {
  chapterNumber: number;
  content: string;
  existingVersions?: ChapterVersionItem[];
  author?: 'ia' | 'user' | 'review_patch';
  label?: string;
}): ChapterVersionItem {
  const versionNumber =
    existingVersions.filter((v) => v.chapterNumber === chapterNumber).length + 1;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return {
    id: `ver-c${chapterNumber}-v${versionNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    chapterNumber,
    versionNumber,
    createdAt: new Date().toISOString(),
    author,
    label: label || `Versão ${versionNumber} (${author})`,
    content,
    wordCount,
  };
}
