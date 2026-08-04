import {
  AiProvider,
  TextGenerationRequest,
  TextGenerationResult,
  StructuredRequest,
  ProviderHealth,
} from '../types';
import {
  validateModelForTask,
  getModelCapability,
  calculateEstimatedCost,
  getDefaultModel,
  OPENCODE_DEFAULT_BASE_URL,
  OPENCODE_MODEL_CATALOG,
} from '../catalog';
import { executeWithRetry } from '../retry';
import { validateProviderBaseUrl, sanitizePromptInputs } from '../security';

/**
 * Strips the API key out of a provider error body before it is surfaced.
 *
 * Uses split/join rather than `new RegExp(apiKey, 'g')`: an API key is arbitrary
 * text, and regex metacharacters in it either change the match or throw outright
 * ("sk-a+b(c" raises "Invalid regular expression: Unterminated group"), which
 * replaced the real provider error with a confusing SyntaxError.
 */
function redactApiKey(text: string, apiKey: string): string {
  if (!apiKey) return text;
  return text.split(apiKey).join('***REDACTED***');
}

/**
 * Resolves the OpenCode credential pool for key rotation / failover.
 *
 * Precedence: a client-supplied key takes the ENTIRE `clientKey` string (client
 * config is not multi-key aware) over `process.env.OPENCODE_API_KEY` — it is not
 * merged with the env value. Only when `clientKey` is empty does the function
 * fall back to the server env var, which MAY itself contain multiple keys
 * separated by whitespace, commas, or semicolons (any mix); each is trimmed and
 * empty entries dropped.
 *
 * @param clientKey - `aiConfig.opencodeApiKey` from the request, if the caller
 *   supplied one.
 * @returns Zero or more non-empty key strings, in the order they appeared in the
 *   source string. An empty array means "not configured" — callers must check
 *   `.length === 0` and throw before attempting any request.
 */
function resolveApiKeys(clientKey?: string): string[] {
  const fromClient = (clientKey || '').trim();
  const raw = fromClient || (process.env.OPENCODE_API_KEY || '').trim();
  if (!raw) return [];
  return raw
    .split(/[\s,;]+/)
    .map((k) => k.trim())
    .filter(Boolean);
}

let globalKeyIndex = 0;

/**
 * Picks the model id, and refuses to substitute one silently.
 *
 * The old logic fell back to the catalog default whenever the requested model
 * failed validation, so a typo or an unlisted id quietly produced a book written
 * by a different model than the operator chose -- with no error anywhere. An
 * explicit choice now either runs or fails loudly.
 *
 * OPENCODE_EXTRA_MODELS (comma-separated) extends the allowlist without a code
 * change, which matters because the gateway's exact id strings cannot be verified
 * from here.
 */
function resolveOpenCodeModel(request: TextGenerationRequest): string {
  const explicit = (request.aiConfig?.opencodeModel || request.model || '').trim();

  if (!explicit) {
    return getDefaultModel('opencode', request.taskType);
  }

  if (isExtraAllowedModel(explicit)) {
    return explicit;
  }

  const validation = validateModelForTask('opencode', explicit, request.taskType);
  if (!validation.valid) {
    throw new Error(
      `${validation.reason} Para usar um modelo fora do catálogo, adicione-o a OPENCODE_EXTRA_MODELS no .env do servidor.`
    );
  }

  return explicit;
}

function isExtraAllowedModel(modelId: string): boolean {
  return (process.env.OPENCODE_EXTRA_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
    .includes(modelId);
}

/**
 * Capability metadata for cost/token estimation. Models allowed via
 * OPENCODE_EXTRA_MODELS have no catalog entry, so they borrow the default's
 * limits -- estimates only, never part of the request.
 */
function resolveCapability(modelId: string) {
  return (
    getModelCapability('opencode', modelId) ||
    getModelCapability('opencode', getDefaultModel('opencode', 'general'))!
  );
}

/**
 * {@link AiProvider} implementation for the OpenCode GO gateway
 * (`OPENCODE_DEFAULT_BASE_URL`, an OpenAI-chat-completions-compatible API).
 *
 * Not meant to be used directly by application code — go through
 * {@link AiOrchestrator} (`orchestrator.ts`), which selects this provider based
 * on `request.aiConfig.provider === 'opencode'` and applies the same error
 * redaction to whatever this class throws.
 */
export class OpenCodeProvider implements AiProvider {
  public name = 'opencode';

  /**
   * Generates free-form text.
   *
   * Key rotation: on each retry attempt (see `executeWithRetry`'s `maxAttempts`,
   * raised here to `Math.max(3, apiKeys.length)` so every configured key gets at
   * least one attempt across a single logical call), the NEXT key in
   * `apiKeys` is used, round-robin, via a MODULE-LEVEL `globalKeyIndex` shared
   * across all in-flight calls and all `OpenCodeProvider` instances in this
   * process. Concurrent calls interleave their key usage rather than each
   * starting from key 0 — this is intentional (it's what makes "rotation"
   * actually distribute load across keys under concurrency) but means key
   * selection for any single call is not deterministic/reproducible if other
   * calls are in flight at the same time.
   *
   * @param request - Prompt, task type, and optional per-call overrides
   *   (`aiConfig.opencodeApiKey`, `.opencodeBaseUrl`, `.opencodeModel`).
   * @returns Provider result with estimated token counts (≈4 chars/token, not a
   *   real tokenizer) and cost.
   * @throws If no API key is resolved (see {@link resolveApiKeys}), if
   *   `opencodeBaseUrl` fails the SSRF check ({@link validateProviderBaseUrl}),
   *   if the requested model fails validation and is not in
   *   `OPENCODE_EXTRA_MODELS` (see {@link resolveOpenCodeModel} — this is a loud
   *   failure by design, not a silent fallback to the default model), or if the
   *   HTTP call itself fails after exhausting all retry attempts.
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const apiKeys = resolveApiKeys(request.aiConfig?.opencodeApiKey);
    if (apiKeys.length === 0) {
      throw new Error(
        'Chave de API do OpenCode não configurada. Defina OPENCODE_API_KEY no .env do servidor ou informe a chave nas Configurações de IA.'
      );
    }

    const rawBaseUrl = request.aiConfig?.opencodeBaseUrl || OPENCODE_DEFAULT_BASE_URL;
    const ssrfCheck = validateProviderBaseUrl(rawBaseUrl);
    if (!ssrfCheck.safe || !ssrfCheck.sanitizedUrl) {
      throw new Error(`Segurança de Rede (SSRF): ${ssrfCheck.reason}`);
    }

    const baseUrl = ssrfCheck.sanitizedUrl;
    const modelId = resolveOpenCodeModel(request);
    const modelCapability = resolveCapability(modelId);

    const { sanitizedPrompt, injectionGuardInstruction } = sanitizePromptInputs(
      request.prompt,
      request.userMaterials,
      request.userRestrictions
    );

    const messages = [
      { role: 'system', content: `${request.systemInstruction}\n${injectionGuardInstruction}` },
      { role: 'user', content: sanitizedPrompt },
    ];

    const body: any = {
      model: modelId,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxOutputTokens || modelCapability.maxOutputTokens,
    };

    const startTime = Date.now();

    const responseContent = await executeWithRetry({
      providerName: 'opencode',
      maxAttempts: Math.max(4, apiKeys.length * 2),
      timeoutMs: 180000,
      operation: async (signal) => {
        // Non-null: the index is always < apiKeys.length (modulo), and apiKeys.length > 0
        // is guaranteed by the guard above. TS can't see that invariant through the
        // modulo, hence the assertion rather than a redundant runtime check.
        const apiKey = apiKeys[globalKeyIndex % apiKeys.length]!;
        globalKeyIndex = (globalKeyIndex + 1) % apiKeys.length;

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          const safeErr = redactApiKey(errText, apiKey);
          throw new Error(`Erro OpenCode GO (${res.status}): ${safeErr}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      },
    });

    const durationMs = Date.now() - startTime;
    const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    const outputTokens = Math.ceil(responseContent.length / 4);
    const estimatedCostUsd = calculateEstimatedCost(modelCapability, inputTokens, outputTokens);

    return {
      text: responseContent,
      provider: 'opencode',
      model: modelId,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      durationMs,
    };
  }

  /**
   * Generates JSON-structured output. Same key rotation, model resolution, SSRF
   * checking, and throw conditions as {@link generateText} — see that method's
   * doc for the full contract. Differs only in requesting
   * `response_format: { type: 'json_object' }` from the gateway, parsing the
   * result as JSON, and running `request.validator` against it if supplied.
   *
   * @throws Additionally throws if the response is not valid JSON, or if
   *   `request.validator` rejects the parsed object.
   */
  async generateStructured<T>(
    request: StructuredRequest<T>
  ): Promise<{ data: T; result: TextGenerationResult }> {
    const apiKeys = resolveApiKeys(request.aiConfig?.opencodeApiKey);
    if (apiKeys.length === 0) {
      throw new Error(
        'Chave de API do OpenCode não configurada. Defina OPENCODE_API_KEY no .env do servidor ou informe a chave nas Configurações de IA.'
      );
    }

    const rawBaseUrl = request.aiConfig?.opencodeBaseUrl || OPENCODE_DEFAULT_BASE_URL;
    const ssrfCheck = validateProviderBaseUrl(rawBaseUrl);
    if (!ssrfCheck.safe || !ssrfCheck.sanitizedUrl) {
      throw new Error(`Segurança de Rede (SSRF): ${ssrfCheck.reason}`);
    }

    const baseUrl = ssrfCheck.sanitizedUrl;
    const modelId = resolveOpenCodeModel(request);
    const modelCapability = resolveCapability(modelId);

    const { sanitizedPrompt, injectionGuardInstruction } = sanitizePromptInputs(
      request.prompt,
      request.userMaterials,
      request.userRestrictions
    );

    const messages = [
      {
        role: 'system',
        content: `${request.systemInstruction}\n${injectionGuardInstruction}\n[REGRA DE FORMATO]: Retorne ESTRITAMENTE um objeto JSON válido.`,
      },
      { role: 'user', content: sanitizedPrompt },
    ];

    const body: any = {
      model: modelId,
      messages,
      temperature: request.temperature ?? 0.2,
      response_format: { type: 'json_object' },
      max_tokens: request.maxOutputTokens || modelCapability.maxOutputTokens,
    };

    const startTime = Date.now();

    const responseContent = await executeWithRetry({
      providerName: 'opencode',
      maxAttempts: Math.max(4, apiKeys.length * 2),
      timeoutMs: request.taskType === 'plan' ? 240000 : 180000,
      operation: async (signal) => {
        // Non-null: the index is always < apiKeys.length (modulo), and apiKeys.length > 0
        // is guaranteed by the guard above. TS can't see that invariant through the
        // modulo, hence the assertion rather than a redundant runtime check.
        const apiKey = apiKeys[globalKeyIndex % apiKeys.length]!;
        globalKeyIndex = (globalKeyIndex + 1) % apiKeys.length;

        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
          signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          const safeErr = redactApiKey(errText, apiKey);
          throw new Error(`Erro OpenCode GO (${res.status}): ${safeErr}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      },
    });

    const durationMs = Date.now() - startTime;

    let parsedData: any;
    try {
      const cleanJsonStr = responseContent
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedData = JSON.parse(cleanJsonStr);
    } catch (parseErr) {
      throw new Error(
        `Falha ao converter a resposta da OpenCode GO para JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      );
    }

    if (request.validator) {
      const validationRes = request.validator(parsedData);
      if (!validationRes.success) {
        throw new Error(
          `Resposta da OpenCode GO não atende ao schema esperado: ${validationRes.error}`
        );
      }
      parsedData = validationRes.data;
    }

    const inputTokens = Math.ceil(JSON.stringify(messages).length / 4);
    const outputTokens = Math.ceil(responseContent.length / 4);
    const estimatedCostUsd = calculateEstimatedCost(modelCapability, inputTokens, outputTokens);

    const result: TextGenerationResult = {
      text: responseContent,
      provider: 'opencode',
      model: modelId,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      durationMs,
    };

    return { data: parsedData, result };
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: 'opencode',
      status: 'ok',
      details: (process.env.OPENCODE_API_KEY || '').trim()
        ? 'Chave configurada no servidor (não verificado contra a API).'
        : 'Adapter ativo; nenhuma chave no servidor — será exigida do cliente.',
      modelsAvailable: Object.keys(OPENCODE_MODEL_CATALOG),
    };
  }
}
