import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenCodeProvider } from '../../src/lib/ai/providers/openCodeProvider';
import {
  OPENCODE_DEFAULT_MODEL,
  OPENCODE_MODEL_CATALOG,
  getDefaultModel,
} from '../../src/lib/ai/catalog';
import { recordSuccess } from '../../src/lib/ai/retry';

/** Captures the outgoing request so assertions can inspect what hit the wire. */
function stubFetch(payload: unknown = { choices: [{ message: { content: 'ok' } }] }) {
  const spy = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }));
  vi.stubGlobal('fetch', spy);
  return spy;
}

const baseRequest = {
  systemInstruction: 'sys',
  prompt: 'p',
  taskType: 'writing' as const,
};

describe('OpenCode provider configuration', () => {
  beforeEach(() => {
    delete process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_EXTRA_MODELS;
    // The circuit breaker is module-level state shared across tests.
    recordSuccess('opencode');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_EXTRA_MODELS;
  });

  it('OPC-001: deepseek-v4-flash is the default model', () => {
    expect(OPENCODE_DEFAULT_MODEL).toBe('deepseek-v4-flash');
    expect(OPENCODE_MODEL_CATALOG[OPENCODE_DEFAULT_MODEL]).toBeDefined();
    expect(getDefaultModel('opencode', 'writing')).toBe('deepseek-v4-flash');
  });

  it('OPC-002: Uses OPENCODE_API_KEY from the server env when the client sends none', async () => {
    process.env.OPENCODE_API_KEY = 'chave-do-servidor';
    const spy = stubFetch();

    await new OpenCodeProvider().generateText({ ...baseRequest });

    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer chave-do-servidor');
    // And the default model is what actually goes out.
    expect(JSON.parse(String(init.body)).model).toBe('deepseek-v4-flash');
  });

  it('OPC-003: A client-supplied key still wins over the server env', async () => {
    process.env.OPENCODE_API_KEY = 'chave-do-servidor';
    const spy = stubFetch();

    await new OpenCodeProvider().generateText({
      ...baseRequest,
      aiConfig: { opencodeApiKey: 'chave-do-cliente' },
    });

    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer chave-do-cliente');
  });

  it('OPC-004: Explains where to put the key when neither source has one', async () => {
    stubFetch();
    await expect(new OpenCodeProvider().generateText({ ...baseRequest })).rejects.toThrow(
      /OPENCODE_API_KEY/
    );
  });

  it('OPC-005: Rejects an unknown model instead of silently substituting one', async () => {
    // This is the important one. The old code fell back to the catalog default
    // whenever validation failed, so a typo'd id produced a book written by a
    // different model than the operator selected, with no error anywhere.
    process.env.OPENCODE_API_KEY = 'k';
    const spy = stubFetch();

    await expect(
      new OpenCodeProvider().generateText({
        ...baseRequest,
        aiConfig: { opencodeModel: 'deepseek-v4-flashh' },
      })
    ).rejects.toThrow(/não é permitido|OPENCODE_EXTRA_MODELS/);

    expect(spy).not.toHaveBeenCalled();
  });

  it('OPC-006: OPENCODE_EXTRA_MODELS admits ids the catalog does not list', async () => {
    // The gateway's exact id strings cannot be verified from here, so operators
    // need a way past the allowlist without editing code.
    process.env.OPENCODE_API_KEY = 'k';
    process.env.OPENCODE_EXTRA_MODELS = 'deepseek-v4-flash-preview, algum/outro-modelo';
    const spy = stubFetch();

    await new OpenCodeProvider().generateText({
      ...baseRequest,
      aiConfig: { opencodeModel: 'deepseek-v4-flash-preview' },
    });

    const [, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).model).toBe('deepseek-v4-flash-preview');
  });
});
