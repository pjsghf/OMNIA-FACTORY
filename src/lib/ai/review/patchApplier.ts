import { BookMetadata, ReviewFinding } from '../../../types';
import { countWords } from '../validation/contentValidator';
import { checkChapterCoverage } from '../validation/coverageChecker';

export interface PatchApplyResult {
  success: boolean;
  newContent: string;
  appliedFindingIds: string[];
  skippedFindingIds: string[];
  warning?: string;
  wordCountDelta: number;
}

export function applyGranularFindingPatch({
  originalContent,
  finding,
  replacementText,
  metadata,
}: {
  originalContent: string;
  finding: ReviewFinding;
  replacementText: string;
  metadata?: BookMetadata;
}): PatchApplyResult {
  let newContent = originalContent;
  let applied = false;

  // Attempt 1: Exact offset matching if start & end are present
  if (typeof finding.start === 'number' && typeof finding.end === 'number') {
    const targetSlice = originalContent.slice(finding.start, finding.end);
    if (!finding.snippet || targetSlice === finding.snippet) {
      newContent =
        originalContent.slice(0, finding.start) +
        replacementText +
        originalContent.slice(finding.end);
      applied = true;
    }
  }

  // Attempt 2: Snippet matching if offsets are out of sync
  if (!applied && finding.snippet && finding.snippet.trim().length > 5) {
    const idx = originalContent.indexOf(finding.snippet);
    if (idx !== -1) {
      newContent =
        originalContent.slice(0, idx) +
        replacementText +
        originalContent.slice(idx + finding.snippet.length);
      applied = true;
    }
  }

  // Attempt 3: If offset/snippet fails, refuse destructive blind replacement unless full rewrite
  if (!applied) {
    return {
      success: false,
      newContent: originalContent,
      appliedFindingIds: [],
      skippedFindingIds: [finding.id],
      warning: `O trecho original para "${finding.descricao}" foi modificado. Execute uma nova auditoria para obter a sugestão atualizada.`,
      wordCountDelta: 0,
    };
  }

  const oldWords = countWords(originalContent);
  const newWords = countWords(newContent);
  const delta = newWords - oldWords;

  let warning: string | undefined;

  // Requirement 6.8: Validate word shrinkage or mandatory items loss
  if (oldWords > 500 && newWords < oldWords * 0.75) {
    warning = `Atenção: A correção reduziu o tamanho do capítulo em mais de 25% (${oldWords} -> ${newWords} palavras).`;
  }

  if (metadata) {
    const coverageReport = checkChapterCoverage(newContent, [], metadata);
    if (coverageReport.forbiddenTermsViolated.length > 0) {
      warning =
        (warning ? warning + ' ' : '') +
        `Atenção: A alteração introduziu termos proibidos: ${coverageReport.forbiddenTermsViolated.join(', ')}.`;
    }
  }

  return {
    success: true,
    newContent,
    appliedFindingIds: [finding.id],
    skippedFindingIds: [],
    warning,
    wordCountDelta: delta,
  };
}
