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

export async function generateChapterInBlocks({
  metadata,
  plan,
  chapterPlan,
  memory,
  aiConfig,
  onProgress,
}: {
  metadata: BookMetadata;
  plan?: EditorialPlan | null;
  chapterPlan: ChapterPlan;
  memory: BookBibleMemory;
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
      const normalized = normalizeProse(rawText);

      const validation = validateChapterContent(normalized, blockPlan.estimativaPalavras, metadata.idioma);

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
