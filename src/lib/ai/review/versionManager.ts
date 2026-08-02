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
    if (oldWords[i] === newWords[j]) {
      result.push({ type: 'unchanged', value: oldWords[i] });
      i++;
      j++;
    } else {
      // Lookahead for match
      let matchIdxNew = -1;
      let matchIdxOld = -1;

      for (let k = j + 1; k < Math.min(j + 10, newWords.length); k++) {
        if (newWords[k] === oldWords[i]) {
          matchIdxNew = k;
          break;
        }
      }

      for (let k = i + 1; k < Math.min(i + 10, oldWords.length); k++) {
        if (oldWords[k] === newWords[j]) {
          matchIdxOld = k;
          break;
        }
      }

      if (matchIdxNew !== -1) {
        while (j < matchIdxNew) {
          result.push({ type: 'added', value: newWords[j] });
          j++;
        }
      } else if (matchIdxOld !== -1) {
        while (i < matchIdxOld) {
          result.push({ type: 'removed', value: oldWords[i] });
          i++;
        }
      } else {
        result.push({ type: 'removed', value: oldWords[i] });
        result.push({ type: 'added', value: newWords[j] });
        i++;
        j++;
      }
    }
  }

  while (i < oldWords.length) {
    result.push({ type: 'removed', value: oldWords[i] });
    i++;
  }

  while (j < newWords.length) {
    result.push({ type: 'added', value: newWords[j] });
    j++;
  }

  return result;
}

export function createChapterVersion({
  chapterNumber,
  content,
  author = 'ia',
  label,
}: {
  chapterNumber: number;
  content: string;
  author?: 'ia' | 'user' | 'review_patch';
  label?: string;
}): ChapterVersionItem {
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  return {
    id: `ver-c${chapterNumber}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    chapterNumber,
    versionNumber: 1,
    createdAt: new Date().toISOString(),
    author,
    label: label || `Versão (${author})`,
    content,
    wordCount,
  };
}

export function createNewChapterVersion({
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
}): { newVersion: ChapterVersionItem; allVersions: ChapterVersionItem[] } {
  const currentChapterVersions = existingVersions.filter((v) => v.chapterNumber === chapterNumber);
  const nextNum = currentChapterVersions.length + 1;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  const newVersion: ChapterVersionItem = {
    id: `ver-c${chapterNumber}-v${nextNum}-${Date.now()}`,
    chapterNumber,
    versionNumber: nextNum,
    createdAt: new Date().toISOString(),
    author,
    label: label || `Versão ${nextNum} (${author === 'review_patch' ? 'Correção de Auditoria' : author === 'user' ? 'Edição Manual' : 'Geração de IA'})`,
    content,
    wordCount,
  };

  return {
    newVersion,
    allVersions: [newVersion, ...existingVersions],
  };
}
