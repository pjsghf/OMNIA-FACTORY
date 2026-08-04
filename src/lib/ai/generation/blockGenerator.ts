import { BookMetadata, EditorialPlan, ChapterPlan } from '../../../types';
import { aiOrchestrator } from '../orchestrator';
import { buildChapterSectionPlan, DetailedChapterPlan } from '../planning/chapterSectionPlanner';
import { buildWriterSectionBlockPrompt } from '../prompts/promptBuilder';
import { BookBibleMemory, updateBookBibleMemoryWithChapter } from '../memory/bookBibleMemory';
import { validateChapterContent } from '../validation/contentValidator';
import { normalizeProse } from '../normalization/proseNormalizer';

export interface GenerationProgressCallback {
  (progress: {
    chapterIndex: number;
    currentBlock: number;
    totalBlocks: number;
    statusText: string;
    partialContent: string;
  }): void;
}

/**
 * Generates one chapter's full text by writing it in sequential blocks (see
 * {@link buildChapterSectionPlan} for how a chapter is split — typically 2-4
 * blocks of 700-1200 words each), then folds the finished chapter into the
 * running {@link BookBibleMemory}.
 *
 * CONTINUITY MODEL (the reason this function exists rather than one big prompt):
 * three layers hand context forward so blocks and chapters do not repeat
 * themselves or contradict each other:
 *   1. Within THIS chapter: each block after the first receives the raw tail of
 *      the immediately preceding block's text (`precedingBlockText`), so it can
 *      pick the thread back up instead of re-explaining what was just written.
 *   2. Across PAST chapters, once memory exists: `memory.resumosCapitulos` (the
 *      BookBible) is the authoritative summary of every chapter written so far.
 *   3. Across PAST chapters, before memory exists: `previousSummaries` (caller-
 *      supplied chapter digests) is used ONLY as a fallback while
 *      `memory.resumosCapitulos` is still empty — see `promptBuilder.ts`'s
 *      `buildWriterSectionBlockPrompt`. This matters for a project restored
 *      from an old backup predating the BookBible memory feature.
 *
 * PER-BLOCK RETRY: each block gets up to 3 generation attempts if
 * {@link validateChapterContent} rejects the output (too short, truncated,
 * wrong language). On the 3rd attempt the result is accepted regardless of
 * validation — this function never throws for a "bad" block, it always returns
 * *something* for every block position. Validation quality is only visible to
 * the caller via `console.warn` logs, not the return value.
 *
 * @param metadata - Book-level config (language, style, tone, word targets).
 * @param plan - The full editorial plan, if available (used for cross-chapter
 *   concept references in the prompt); `chapterPlan` alone is sufficient to
 *   generate this one chapter.
 * @param chapterPlan - This specific chapter's plan entry (number, title,
 *   topics, target word count).
 * @param memory - The BookBible memory accumulated from prior chapters.
 * @param previousSummaries - Fallback chapter digests; see layer 3 above.
 * @param aiConfig - Provider/model selection, forwarded to every block's
 *   generation call unchanged.
 * @param onProgress - Optional callback invoked before each block starts, with
 *   the concatenation of already-completed blocks as `partialContent` (for a
 *   live-preview UI; the blocks after `partialContent` are not yet written).
 * @returns `fullChapterText` (all blocks joined with a blank line), `wordCount`,
 *   `updatedMemory` (memory with this chapter's entry added/replaced — the
 *   caller is responsible for persisting this back onto the project), and
 *   `completedBlocks` (always equals the planned block count — see the retry
 *   note above, this is not a count of *successful* blocks).
 */
export async function generateChapterInBlocks({
  metadata,
  plan,
  chapterPlan,
  memory,
  previousSummaries,
  aiConfig,
  onProgress,
}: {
  metadata: BookMetadata;
  plan?: EditorialPlan | null;
  chapterPlan: ChapterPlan;
  memory: BookBibleMemory;
  previousSummaries?: string[];
  aiConfig?: any;
  onProgress?: GenerationProgressCallback;
}): Promise<{
  fullChapterText: string;
  wordCount: number;
  updatedMemory: BookBibleMemory;
  completedBlocks: number;
}> {
  const detailedPlan: DetailedChapterPlan = buildChapterSectionPlan(chapterPlan, metadata);
  const blockContents: string[] = [];

  for (let b = 0; b < detailedPlan.sections.length; b++) {
    const blockPlan = detailedPlan.sections[b];
    if (!blockPlan) continue;

    if (onProgress) {
      onProgress({
        chapterIndex: chapterPlan.numero - 1,
        currentBlock: b + 1,
        totalBlocks: detailedPlan.sections.length,
        statusText: `Redigindo bloco ${b + 1}/${detailedPlan.sections.length}: "${blockPlan.tituloBloco}"...`,
        partialContent: blockContents.join('\n\n'),
      });
    }

    const promptPkg = buildWriterSectionBlockPrompt({
      metadata,
      plan,
      chapterPlan,
      sectionBlock: blockPlan,
      memory,
      previousSummaries,
      // Blocks used to be written blind of each other, which produced repeated
      // ideas and broken transitions inside a single chapter. Hand the writer the
      // tail of what was already written so it can pick the thread back up.
      precedingBlockText:
        blockContents.length > 0 ? blockContents[blockContents.length - 1] : undefined,
    });

    let attempts = 0;
    let blockText = '';
    let isValidBlock = false;

    while (attempts < 3 && !isValidBlock) {
      attempts++;
      const result = await aiOrchestrator.generateText({
        systemInstruction: promptPkg.systemInstruction,
        prompt: promptPkg.userPrompt,
        taskType: 'writing',
        userMaterials: metadata.materiais,
        userRestrictions: metadata.restricoes,
        aiConfig,
      });

      const rawText = result.text || '';
      const normalized = normalizeProse(rawText, chapterPlan.numero, chapterPlan.titulo);

      const validation = validateChapterContent(
        normalized,
        blockPlan.estimativaPalavras,
        metadata.idioma
      );

      if (validation.valid || attempts === 3) {
        blockText = normalized;
        isValidBlock = true;
      } else {
        console.warn(
          `[BlockGen] Bloco ${b + 1} tentado (${attempts}/3) falhou na validação: ${validation.issues.join('; ')}`
        );
      }
    }

    blockContents.push(blockText);
  }

  const fullChapterText = blockContents.join('\n\n');
  const wordCount = fullChapterText.split(/\s+/).filter((w) => w.length > 0).length;

  const updatedMemory = updateBookBibleMemoryWithChapter(
    memory,
    chapterPlan.numero,
    chapterPlan.titulo,
    fullChapterText
  );

  return {
    fullChapterText,
    wordCount,
    updatedMemory,
    completedBlocks: detailedPlan.sections.length,
  };
}
