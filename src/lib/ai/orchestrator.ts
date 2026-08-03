import {
  AiProvider,
  TextGenerationRequest,
  TextGenerationResult,
  StructuredRequest,
  ImageGenerationRequest,
  ImageResult,
  ProviderHealth,
} from './types';
import { GeminiProvider } from './providers/geminiProvider';
import { OpenCodeProvider } from './providers/openCodeProvider';

export class AiOrchestrator {
  private providers: Map<string, AiProvider> = new Map();

  constructor() {
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('opencode', new OpenCodeProvider());
  }

  private getProvider(providerName?: string): AiProvider {
    const key = providerName || 'gemini';
    const provider = this.providers.get(key);
    if (!provider) {
      throw new Error(
        `Provedor de IA desconhecido: '${key}'. Provedores suportados: 'gemini', 'opencode'.`
      );
    }
    return provider;
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const selectedProviderName = request.aiConfig?.provider || 'gemini';
    const provider = this.getProvider(selectedProviderName);

    try {
      return await provider.generateText(request);
    } catch (err: any) {
      this.normalizeAndThrowError(err, selectedProviderName);
    }
  }

  async generateStructured<T>(
    request: StructuredRequest<T>
  ): Promise<{ data: T; result: TextGenerationResult }> {
    const selectedProviderName = request.aiConfig?.provider || 'gemini';
    const provider = this.getProvider(selectedProviderName);

    try {
      return await provider.generateStructured<T>(request);
    } catch (err: any) {
      this.normalizeAndThrowError(err, selectedProviderName);
    }
  }

  async generateImage(request: ImageGenerationRequest): Promise<ImageResult> {
    const provider = this.getProvider('gemini'); // Gemini Imagen provider for covers

    if (!provider.generateImage) {
      throw new Error('O provedor selecionado não suporta geração de imagem.');
    }

    try {
      return await provider.generateImage(request);
    } catch (err: any) {
      this.normalizeAndThrowError(err, 'gemini');
    }
  }

  async healthCheck(): Promise<Record<string, ProviderHealth>> {
    const results: Record<string, ProviderHealth> = {};
    for (const [name, provider] of this.providers.entries()) {
      try {
        results[name] = await provider.healthCheck();
      } catch (err: any) {
        results[name] = {
          provider: name,
          status: 'unavailable',
          details: err.message || 'Falha na verificação de saúde.',
          modelsAvailable: [],
        };
      }
    }
    return results;
  }

  private normalizeAndThrowError(err: any, providerName: string): never {
    const rawMsg = String(err?.message || err || 'Erro interno no serviço de IA.');

    // Redact potential API keys or authorization headers
    const redactedMsg = rawMsg
      .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '***GEMINI_KEY_REDACTED***')
      .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***TOKEN_REDACTED***');

    // Categorize error codes for clean public responses
    let code = 'PROVIDER_ERROR';
    if (
      redactedMsg.includes('SSRF') ||
      redactedMsg.includes('inseguro') ||
      redactedMsg.includes('proibido')
    ) {
      code = 'SSRF_PROTECTION_ERROR';
    } else if (
      redactedMsg.includes('não é permitido') ||
      redactedMsg.includes('não suporta a tarefa')
    ) {
      code = 'MODEL_NOT_ALLOWED';
    } else if (
      redactedMsg.includes('429') ||
      redactedMsg.includes('quota') ||
      redactedMsg.includes('limite')
    ) {
      code = 'RATE_LIMIT_EXCEEDED';
    } else if (redactedMsg.includes('JSON') || redactedMsg.includes('schema')) {
      code = 'INVALID_SCHEMA_RESPONSE';
    }

    const safeError = new Error(`[${code}] Provedor ${providerName}: ${redactedMsg}`);
    (safeError as any).code = code;
    (safeError as any).provider = providerName;
    throw safeError;
  }
}

export const aiOrchestrator = new AiOrchestrator();
