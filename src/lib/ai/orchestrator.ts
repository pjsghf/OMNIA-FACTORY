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

/**
 * Facade over the concrete AI providers ({@link GeminiProvider}, {@link OpenCodeProvider}).
 *
 * This is the ONLY entry point application code (server.ts, generation/*, review/*)
 * should call for text/structured/image generation — never import a provider class
 * directly. Routing here means every call automatically gets: provider selection
 * from `request.aiConfig.provider`, and error redaction + taxonomy via
 * {@link normalizeAndThrowError} regardless of which provider or SDK raised it.
 *
 * A singleton instance is exported as {@link aiOrchestrator}; there is normally no
 * reason to construct a second `AiOrchestrator`.
 */
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

  private resolveProviderName(aiConfig?: any): string {
    const requested = aiConfig?.provider;
    if (requested && this.providers.has(requested)) {
      // If requested is gemini but GEMINI_API_KEY is unset while OPENCODE_API_KEY is set, default to opencode
      if (requested === 'gemini' && !process.env.GEMINI_API_KEY && process.env.OPENCODE_API_KEY) {
        return 'opencode';
      }
      return requested;
    }
    if (process.env.OPENCODE_API_KEY && !process.env.GEMINI_API_KEY) {
      return 'opencode';
    }
    return 'gemini';
  }
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const selectedProviderName = this.resolveProviderName(request.aiConfig);
    const provider = this.getProvider(selectedProviderName);

    try {
      return await provider.generateText(request);
    } catch (err: any) {
      const fallbackProviderName = selectedProviderName === 'gemini' ? 'opencode' : 'gemini';
      if (
        String(err?.message || '').includes('não configurada') &&
        this.providers.has(fallbackProviderName)
      ) {
        try {
          return await this.getProvider(fallbackProviderName).generateText({
            ...request,
            aiConfig: { ...request.aiConfig, provider: fallbackProviderName as any },
          });
        } catch {
          // Keep original error
        }
      }
      this.normalizeAndThrowError(err, selectedProviderName);
    }
  }

  /**
   * Generates JSON-structured output (used for the editorial plan and the
   * per-unit / reduce-stage review reports).
   *
   * @param request - Same as {@link generateText}, plus an optional `validator`
   *   the provider runs against the parsed JSON before returning it.
   * @returns `data` (parsed and, if `request.validator` was supplied,
   *   validator-approved JSON) alongside the same result metadata as
   *   {@link generateText}.
   * @throws A redacted `Error` (see {@link generateText}) — additionally, this
   *   is where a model returning malformed JSON, or JSON that fails
   *   `request.validator`, surfaces as `INVALID_SCHEMA_RESPONSE`.
   */
  async generateStructured<T>(
    request: StructuredRequest<T>
  ): Promise<{ data: T; result: TextGenerationResult }> {
    const selectedProviderName = this.resolveProviderName(request.aiConfig);
    const provider = this.getProvider(selectedProviderName);

    try {
      return await provider.generateStructured<T>(request);
    } catch (err: any) {
      const fallbackProviderName = selectedProviderName === 'gemini' ? 'opencode' : 'gemini';
      if (
        String(err?.message || '').includes('não configurada') &&
        this.providers.has(fallbackProviderName)
      ) {
        try {
          return await this.getProvider(fallbackProviderName).generateStructured<T>({
            ...request,
            aiConfig: { ...request.aiConfig, provider: fallbackProviderName as any },
          });
        } catch {
          // Keep original error
        }
      }
      this.normalizeAndThrowError(err, selectedProviderName);
    }
  }

  /**
   * Generates a cover background image.
   *
   * BUSINESS RULE: hardcoded to the `'gemini'` provider regardless of
   * `request.aiConfig.provider` — OpenCode has no image-generation capability
   * wired up ({@link OpenCodeProvider} does not implement `generateImage`), so
   * routing here is not configurable per-request the way text generation is.
   *
   * @param request - Image prompt plus cover metadata (title/author/etc, used by
   *   some callers for prompt context, not by this method directly).
   * @returns The generated image as a data URI, or throws (see below) — callers
   *   in `server.ts` catch this and fall back to the vector SVG cover compositor,
   *   so a thrown error here is an expected, handled path, not a hard failure of
   *   cover generation as a whole.
   * @throws A redacted `Error` (see {@link generateText}) if Gemini's image API
   *   fails, or a plain `Error` if somehow invoked when the `'gemini'` provider
   *   entry lacked `generateImage` (defensive; not currently reachable).
   */
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

  /**
   * Redacts and re-throws a provider error with a stable `.code` classification.
   *
   * The `never` return type is load-bearing, not decorative: every caller in
   * this class invokes it as the sole statement in a `catch` block with no
   * `return`/`throw` after it (e.g. `catch (err) { this.normalizeAndThrowError(...) }`
   * as the last line of an `async` method). TypeScript accepts those methods as
   * satisfying their `Promise<T>` return type only because it can see this
   * function never returns normally. If you ever change this to sometimes
   * `return` instead of always throwing, every call site becomes a "not all code
   * paths return a value" compile error — that is the safety net working, not a
   * bug to work around.
   *
   * Redaction covers Gemini API key patterns (`AIzaSy...`) and `Bearer <token>`
   * headers; classification is substring-matching on the (already redacted)
   * message against known phrases from `security.ts` / `catalog.ts` / the
   * provider HTTP clients — it is a best-effort taxonomy for clean API
   * responses, not a guarantee every error lands in the "right" bucket.
   *
   * @param err - The raw error caught from a provider call.
   * @param providerName - Attached to the thrown error as `.provider`.
   * @throws Always. Never returns.
   */
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
