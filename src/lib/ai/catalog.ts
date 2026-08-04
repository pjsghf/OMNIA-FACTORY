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

/** Model the app runs on by default. */
export const OPENCODE_DEFAULT_MODEL = 'deepseek-v4-flash';

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
  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash',
    displayName: 'DeepSeek V4 Flash (OpenCode)',
    provider: 'opencode',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    // Pricing is a placeholder: it feeds cost logging only, never a request. Update
    // it from the OpenCode dashboard -- a wrong number here misreports spend, it
    // does not break generation.
    inputCostPer1k: 0.00027,
    outputCostPer1k: 0.0011,
    contextWindow: 128000,
    isDefault: true,
  },
  'opencode/claude-3-5-sonnet': {
    id: 'opencode/claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet (OpenCode)',
    provider: 'opencode',
    allowedTasks: ['plan', 'writing', 'review', 'general'],
    maxOutputTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    contextWindow: 200000,
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

/**
 * Looks up a model's static capability record (limits, pricing, allowed tasks).
 *
 * This is the allowlist: a model id that is not a key in {@link GEMINI_MODEL_CATALOG}
 * or {@link OPENCODE_MODEL_CATALOG} is, by construction, not usable by this
 * application — there is no other path to reach the provider API with an id.
 *
 * @param provider - Which catalog to search.
 * @param modelId - Exact id string (e.g. `"gemini-2.5-flash"`, `"deepseek-v4-flash"`).
 *   OpenCode ids admitted via `OPENCODE_EXTRA_MODELS` (see openCodeProvider.ts) are
 *   intentionally NOT in this catalog and will return `null` here; callers on that
 *   path fall back to the default model's capability for cost/token estimation.
 * @returns The capability record, or `null` if `modelId` is not in the catalog.
 */
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

/**
 * Checks whether a model may be used for a given task type.
 *
 * Two independent gates, both must pass: the model must exist in the catalog
 * (see {@link getModelCapability}), and its `allowedTasks` must include `task`
 * (e.g. Imagen models are `image`-only and are rejected for `writing`/`plan`/etc).
 *
 * Never throws. Callers are expected to check `.valid` and surface `.reason`
 * (already human-readable, Portuguese) as the user-facing error — this is the
 * validation both provider implementations run before making an upstream call,
 * so a `false` result here means the request never leaves the process.
 *
 * @param provider - Which catalog to validate against.
 * @param modelId - The model id requested (by the client or a caller default).
 * @param task - The task the model is about to be used for.
 * @returns `{ valid: true }`, or `{ valid: false, reason }` with a message safe
 *   to return directly to the end user.
 */
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

/**
 * Resolves which model id to use when the caller did not pin one explicitly.
 *
 * Resolution order: (1) the catalog entry flagged `isDefault: true` that also
 * supports `task`; (2) failing that, the first catalog entry (in object key
 * order) that supports `task`; (3) a hardcoded last-resort id, only reachable if
 * the whole catalog were emptied of entries supporting `task` (should not happen
 * with the shipped catalogs — every task type has at least one flash/default model).
 *
 * BUSINESS RULE: only one entry per catalog should carry `isDefault: true`. If two
 * did, `Object.values(...).find(...)` would silently pick whichever comes first in
 * object insertion order — no error, just an arbitrary choice. Not enforced at
 * runtime; keep it true by inspection when editing the catalogs.
 *
 * @param provider - `'gemini'` or `'opencode'`.
 * @param task - The task the resolved model must support.
 * @returns A model id string. Always returns *something* — callers do not need to
 *   handle an empty/undefined case — but the returned id is only guaranteed to
 *   exist in the catalog for cases (1) and (2); the tier-3 fallback ids
 *   (`'gemini-2.5-flash'`, `'opencode/claude-3-5-sonnet'`) are current catalog
 *   members today but are not re-validated against the catalog at return time.
 */
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

/**
 * Estimates the USD cost of one completion, for logging/observability only.
 *
 * Not a billing figure: `inputTokens`/`outputTokens` are themselves estimates
 * (≈4 characters per token; see the `Math.ceil(text.length / 4)` call sites in
 * geminiProvider.ts / openCodeProvider.ts, not an actual tokenizer), and image
 * generation is a flat per-image price rather than token-based. Nothing in this
 * function affects what is actually sent to or billed by the provider.
 *
 * @param modelCapability - Pricing/task info for the model that was used.
 * @param inputTokens - Estimated input token count.
 * @param outputTokens - Estimated output token count.
 * @returns Estimated cost in USD, rounded to 6 decimal places. For image-capable
 *   models this is the flat `outputCostPer1k` value (repurposed as "cost per
 *   image", not literally "per 1k of anything").
 */
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
