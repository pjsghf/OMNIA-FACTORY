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
 * Resolves the OpenCode credentials.
 * Supports comma, semicolon, space, or newline-separated API keys for rotation/failover.
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

export class OpenCodeProvider implements AiProvider {
  public name = 'opencode';

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
      maxAttempts: Math.max(3, apiKeys.length),
      operation: async (signal) => {
        const apiKey = apiKeys[globalKeyIndex % apiKeys.length];
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
      maxAttempts: Math.max(3, apiKeys.length),
      operation: async (signal) => {
        const apiKey = apiKeys[globalKeyIndex % apiKeys.length];
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
