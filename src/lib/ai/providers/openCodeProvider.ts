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
} from '../catalog';
import { executeWithRetry } from '../retry';
import { validateProviderBaseUrl, sanitizePromptInputs } from '../security';

export class OpenCodeProvider implements AiProvider {
  public name = 'opencode';

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const apiKey = request.aiConfig?.opencodeApiKey;
    if (!apiKey) {
      throw new Error('Chave de API do OpenCode GO (opencodeApiKey) não fornecida.');
    }

    const rawBaseUrl = request.aiConfig?.opencodeBaseUrl || 'https://opencode.ai/zen/go/v1';
    const ssrfCheck = validateProviderBaseUrl(rawBaseUrl);
    if (!ssrfCheck.safe || !ssrfCheck.sanitizedUrl) {
      throw new Error(`Segurança de Rede (SSRF): ${ssrfCheck.reason}`);
    }

    const baseUrl = ssrfCheck.sanitizedUrl;
    const userSelectedModel = request.aiConfig?.opencodeModel;
    const modelId =
      userSelectedModel && validateModelForTask('opencode', userSelectedModel, request.taskType).valid
        ? userSelectedModel
        : request.model || getDefaultModel('opencode', request.taskType);

    // Validate model allowlist
    const validation = validateModelForTask('opencode', modelId, request.taskType);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const modelCapability = getModelCapability('opencode', modelId)!;

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
      operation: async (signal) => {
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
          // Redact API key if ever present in error body
          const safeErr = errText.replace(new RegExp(apiKey, 'g'), '***REDACTED***');
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
    const apiKey = request.aiConfig?.opencodeApiKey;
    if (!apiKey) {
      throw new Error('Chave de API do OpenCode GO (opencodeApiKey) não fornecida.');
    }

    const rawBaseUrl = request.aiConfig?.opencodeBaseUrl || 'https://opencode.ai/zen/go/v1';
    const ssrfCheck = validateProviderBaseUrl(rawBaseUrl);
    if (!ssrfCheck.safe || !ssrfCheck.sanitizedUrl) {
      throw new Error(`Segurança de Rede (SSRF): ${ssrfCheck.reason}`);
    }

    const baseUrl = ssrfCheck.sanitizedUrl;
    const userSelectedModel = request.aiConfig?.opencodeModel;
    const modelId =
      userSelectedModel && validateModelForTask('opencode', userSelectedModel, request.taskType).valid
        ? userSelectedModel
        : request.model || getDefaultModel('opencode', request.taskType);

    const validation = validateModelForTask('opencode', modelId, request.taskType);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const modelCapability = getModelCapability('opencode', modelId)!;

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
      operation: async (signal) => {
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
          const safeErr = errText.replace(new RegExp(apiKey, 'g'), '***REDACTED***');
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
      details: 'Provider adapter ativo. Requer opencodeApiKey para solicitações.',
      modelsAvailable: ['opencode/claude-3-5-sonnet', 'opencode/gpt-4o', 'opencode/deepseek-r1'],
    };
  }
}
