import { ModelCapability, AiTaskType } from './types';

/**
 * Canonical OpenCode GO endpoint.
 *
 * The client defaults (App.tsx, AiSettingsModal) used to say
 * "https://opencode.go/api/v1" -- a domain that does not exist -- while the
 * provider fell back to the real one. Since the client always sends aiConfig,
 * the bogus value won and the OpenCode provider could never connect in its
 * default configuration. Kept here (a browser-safe module) so the UI and the
 * server-side provider cannot drift apart again.
 */
export const OPENCODE_DEFAULT_BASE_URL = 'https://opencode.ai/zen/go/v1';

/**
 * NOTE ON DEFAULTS: the default is deliberately the model with the longest track
 * record, not the newest entry in this list. A default that does not exist upstream
 * fails *every* text generation in the app, so the blast radius of guessing wrong
 * here is total. The newer ids remain selectable; verify them against
 * `GET /v1beta/models` (see scripts/verifyProviders.ts) before promoting one.
 */
export const GEMINI_MODEL_CATALOG: Record<string, ModelCapability> = {
  'gemini-3.6-flash': {
    id: 'gemini-3.6-flash',
    displayName: 'Gemini 3.6 Flash',
    provider: 'gemini',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
    contextWindow: 1000000,
  },
  'gemini-3.1-pro-preview': {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro',
    provider: 'gemini',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    contextWindow: 2000000,
  },
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    provider: 'gemini',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.000075,
    outputCostPer1k: 0.0003,
    contextWindow: 1000000,
    isDefault: true,
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    provider: 'gemini',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    contextWindow: 2000000,
  },
  'imagen-3.0-generate-002': {
    id: 'imagen-3.0-generate-002',
    displayName: 'Imagen 3 Standard',
    provider: 'gemini',
    allowedTasks: ['image'],
    maxOutputTokens: 0,
    inputCostPer1k: 0,
    outputCostPer1k: 0.03, // cost per image
    contextWindow: 0,
    isDefault: true,
  },
  'imagen-3.0-fast-generate-001': {
    id: 'imagen-3.0-fast-generate-001',
    displayName: 'Imagen 3 Fast',
    provider: 'gemini',
    allowedTasks: ['image'],
    maxOutputTokens: 0,
    inputCostPer1k: 0,
    outputCostPer1k: 0.015,
    contextWindow: 0,
  },
};

export const OPENCODE_MODEL_CATALOG: Record<string, ModelCapability> = {
  'opencode/claude-3-5-sonnet': {
    id: 'opencode/claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet (OpenCode)',
    provider: 'opencode',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    contextWindow: 200000,
    isDefault: true,
  },
  'opencode/gpt-4o': {
    id: 'opencode/gpt-4o',
    displayName: 'GPT-4o (OpenCode)',
    provider: 'opencode',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 4096,
    inputCostPer1k: 0.0025,
    outputCostPer1k: 0.01,
    contextWindow: 128000,
  },
  'opencode/gemini-2.5-pro': {
    id: 'opencode/gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro (OpenCode)',
    provider: 'opencode',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.00125,
    outputCostPer1k: 0.005,
    contextWindow: 1000000,
  },
  'opencode/deepseek-r1': {
    id: 'opencode/deepseek-r1',
    displayName: 'DeepSeek R1 (OpenCode)',
    provider: 'opencode',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.00055,
    outputCostPer1k: 0.00219,
    contextWindow: 64000,
  },
  'opencode/llama-3.3-70b': {
    id: 'opencode/llama-3.3-70b',
    displayName: 'Llama 3.3 70B (OpenCode)',
    provider: 'opencode',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.0004,
    outputCostPer1k: 0.0004,
    contextWindow: 128000,
  },
};

export function getModelCapability(
  provider: 'gemini' | 'opencode',
  modelId: string
): ModelCapability | null {
  if (provider === 'gemini') {
    return GEMINI_MODEL_CATALOG[modelId] || null;
  } else {
    return OPENCODE_MODEL_CATALOG[modelId] || null;
  }
}

export function validateModelForTask(
  provider: 'gemini' | 'opencode',
  modelId: string,
  task: AiTaskType
): { valid: boolean; reason?: string } {
  const capability = getModelCapability(provider, modelId);
  if (!capability) {
    return {
      valid: false,
      reason: `O modelo '${modelId}' não é permitido ou não existe no catálogo de modelos aprovados do provedor ${provider}.`,
    };
  }

  if (!capability.allowedTasks.includes(task)) {
    return {
      valid: false,
      reason: `O modelo '${modelId}' não suporta a tarefa '${task}'. Tarefas permitidas: ${capability.allowedTasks.join(', ')}.`,
    };
  }

  return { valid: true };
}

export function getDefaultModel(provider: 'gemini' | 'opencode', task: AiTaskType): string {
  const catalog = provider === 'gemini' ? GEMINI_MODEL_CATALOG : OPENCODE_MODEL_CATALOG;
  const match = Object.values(catalog).find((m) => m.isDefault && m.allowedTasks.includes(task));
  if (match) return match.id;
  const anyMatch = Object.values(catalog).find((m) => m.allowedTasks.includes(task));
  return anyMatch
    ? anyMatch.id
    : provider === 'gemini'
      ? 'gemini-2.5-flash'
      : 'opencode/claude-3-5-sonnet';
}

export function calculateEstimatedCost(
  modelCapability: ModelCapability,
  inputTokens: number,
  outputTokens: number
): number {
  if (modelCapability.allowedTasks.includes('image')) {
    return modelCapability.outputCostPer1k; // Fixed per image cost
  }
  const inputCost = (inputTokens / 1000) * modelCapability.inputCostPer1k;
  const outputCost = (outputTokens / 1000) * modelCapability.outputCostPer1k;
  return Number((inputCost + outputCost).toFixed(6));
}
