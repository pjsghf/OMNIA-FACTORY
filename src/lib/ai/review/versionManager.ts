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
