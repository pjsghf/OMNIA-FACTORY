import { BookMetadata, EditorialPlan } from '../../../types';
import { buildMatterPrompt } from '../prompts/promptBuilder';
import { aiOrchestrator } from '../orchestrator';
import { normalizeProse } from '../normalization/proseNormalizer';

export async function generateFrontEndMatter({
  metadata,
  plan,
  fullBookContent,
  type,
  aiConfig,
}: {
  metadata: BookMetadata;
  plan?: EditorialPlan | null;
  fullBookContent: string;
  type:
    'apresentacao' | 'introducao' | 'conclusao' | 'exercicios' | 'agradecimentos' | 'sobreAutor';
  aiConfig?: any;
}): Promise<string> {
  const promptPkg = buildMatterPrompt({
    metadata,
    plan,
    fullBookContent,
    type,
  });

  const result = await aiOrchestrator.generateText({
    systemInstruction: promptPkg.systemInstruction,
    prompt: promptPkg.userPrompt,
    taskType: 'general',
    userMaterials: metadata.materiais,
    userRestrictions: metadata.restricoes,
    aiConfig,
  });

  return normalizeProse(result.text || '');
}
