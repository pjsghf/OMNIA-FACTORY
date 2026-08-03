import { GoogleGenAI } from '@google/genai';
import {
  AiProvider,
  TextGenerationRequest,
  TextGenerationResult,
  StructuredRequest,
  ImageGenerationRequest,
  ImageResult,
  ProviderHealth,
} from '../types';
import {
  validateModelForTask,
  getModelCapability,
  calculateEstimatedCost,
  getDefaultModel,
} from '../catalog';
import { executeWithRetry } from '../retry';
import { sanitizePromptInputs } from '../security';

export class GeminiProvider implements AiProvider {
  public name = 'gemini';

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada no ambiente.');
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'omnia-book-builder/2.0' },
      },
    });
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const modelId = request.model || getDefaultModel('gemini', request.taskType);

    // Validate model allowlist & task capability
    const validation = validateModelForTask('gemini', modelId, request.taskType);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const modelCapability = getModelCapability('gemini', modelId)!;

    // Sanitize prompt inputs against prompt injection
    const { sanitizedPrompt, injectionGuardInstruction } = sanitizePromptInputs(
      request.prompt,
      request.userMaterials,
      request.userRestrictions
    );

    const fullSystemInstruction = `${request.systemInstruction}\n${injectionGuardInstruction}`;
    const startTime = Date.now();

    const outputText = await executeWithRetry({
      providerName: 'gemini',
      operation: async (signal) => {
        const ai = this.getClient();
        const config: any = {
          systemInstruction: fullSystemInstruction,
          temperature: request.temperature ?? 0.7,
        };

        if (request.maxOutputTokens || modelCapability.maxOutputTokens) {
          config.maxOutputTokens = request.maxOutputTokens || modelCapability.maxOutputTokens;
        }

        const response = await ai.models.generateContent({
          model: modelId,
          contents: sanitizedPrompt,
          config,
        });

        return response.text || '';
      },
    });

    const durationMs = Date.now() - startTime;
    // Estimate tokens (approx 4 chars per token if API doesn't return count)
    const inputTokens = Math.ceil((fullSystemInstruction.length + sanitizedPrompt.length) / 4);
    const outputTokens = Math.ceil(outputText.length / 4);
    const estimatedCostUsd = calculateEstimatedCost(modelCapability, inputTokens, outputTokens);

    return {
      text: outputText,
      provider: 'gemini',
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
    const modelId = request.model || getDefaultModel('gemini', request.taskType);

    const validation = validateModelForTask('gemini', modelId, request.taskType);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const modelCapability = getModelCapability('gemini', modelId)!;

    const { sanitizedPrompt, injectionGuardInstruction } = sanitizePromptInputs(
      request.prompt,
      request.userMaterials,
      request.userRestrictions
    );

    const fullSystemInstruction = `${request.systemInstruction}\n${injectionGuardInstruction}\n[REGRA DE FORMATO]: Retorne ESTRITAMENTE um objeto JSON válido, sem cercas de markdown (#) ou textos explicativos ao redor.`;
    const startTime = Date.now();

    const rawText = await executeWithRetry({
      providerName: 'gemini',
      operation: async (signal) => {
        const ai = this.getClient();
        const config: any = {
          systemInstruction: fullSystemInstruction,
          temperature: request.temperature ?? 0.2, // Lower temp for structured tasks
          responseMimeType: 'application/json',
        };

        if (request.maxOutputTokens || modelCapability.maxOutputTokens) {
          config.maxOutputTokens = request.maxOutputTokens || modelCapability.maxOutputTokens;
        }

        const response = await ai.models.generateContent({
          model: modelId,
          contents: sanitizedPrompt,
          config,
        });

        return response.text || '';
      },
    });

    const durationMs = Date.now() - startTime;

    // Parse JSON
    let parsedData: any;
    try {
      const cleanJsonStr = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedData = JSON.parse(cleanJsonStr);
    } catch (parseErr) {
      throw new Error(
        `Falha ao converter a resposta da IA para JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      );
    }

    // Validate with optional validator schema
    if (request.validator) {
      const validationRes = request.validator(parsedData);
      if (!validationRes.success) {
        throw new Error(
          `Resposta da IA não está em conformidade com o schema esperado: ${validationRes.error}`
        );
      }
      parsedData = validationRes.data;
    }

    const inputTokens = Math.ceil((fullSystemInstruction.length + sanitizedPrompt.length) / 4);
    const outputTokens = Math.ceil(rawText.length / 4);
    const estimatedCostUsd = calculateEstimatedCost(modelCapability, inputTokens, outputTokens);

    const result: TextGenerationResult = {
      text: rawText,
      provider: 'gemini',
      model: modelId,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      durationMs,
    };

    return { data: parsedData, result };
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageResult> {
    const modelId = request.model || 'imagen-3.0-generate-002';

    const validation = validateModelForTask('gemini', modelId, 'image');
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    try {
      const ai = this.getClient();
      const imagenResponse = await ai.models.generateImages({
        model: modelId,
        prompt: request.prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: request.aspectRatio || '3:4',
          outputMimeType: 'image/jpeg',
        },
      });

      const base64Bytes = imagenResponse.generatedImages?.[0]?.image?.imageBytes;
      if (base64Bytes) {
        return {
          imageUrl: `data:image/jpeg;base64,${base64Bytes}`,
          provider: 'gemini',
          model: modelId,
        };
      }
    } catch (err: any) {
      console.warn(`[Gemini Image Gen Error]: modelo ${modelId} falhou:`, err.message || err);
      throw new Error(
        `Falha na geração de imagem com o modelo ${modelId}: ${err.message || String(err)}`
      );
    }

    throw new Error(`O modelo de imagem ${modelId} não retornou nenhum dado de imagem.`);
  }

  async healthCheck(): Promise<ProviderHealth> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        provider: 'gemini',
        status: 'unavailable',
        details: 'GEMINI_API_KEY ausente no ambiente.',
        modelsAvailable: [],
      };
    }

    return {
      provider: 'gemini',
      status: 'ok',
      details: 'Conexão ativa e chave configurada.',
      modelsAvailable: [
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        'gemini-2.5-pro',
        'imagen-3.0-generate-002',
      ],
    };
  }
}
