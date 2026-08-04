/**
 * Per-provider circuit breaker + exponential-backoff retry for AI provider calls.
 *
 * State (`circuitBreakers`) is a module-level in-memory `Record`, not persisted
 * and not shared across processes. In a multi-instance deployment each instance
 * breaks its own circuit independently; there is no shared coordination. That is
 * an accepted simplification for this app's single-process deployment model, not
 * an oversight — flag it if this ever runs behind a load balancer with several
 * Node processes and true cross-instance circuit state becomes necessary.
 */
export interface CircuitState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreakers: Record<string, CircuitState> = {};
const FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60000; // 60 seconds cooldown

/**
 * Whether `providerName`'s circuit is currently open (failing fast, no calls
 * attempted). Self-heals: once {@link CIRCUIT_RESET_MS} has elapsed since the
 * last recorded failure, this call itself closes the circuit and resets the
 * failure count — there is no separate timer/scheduler, the check IS the reset.
 *
 * @param providerName - `'gemini'` or `'opencode'` (matches `AiProvider.name`).
 * @returns `true` if calls to this provider should be short-circuited right now.
 */
export function isCircuitOpen(providerName: string): boolean {
  const state = circuitBreakers[providerName];
  if (!state || !state.isOpen) return false;

  // Check if cooldown has elapsed
  if (Date.now() - state.lastFailureTime > CIRCUIT_RESET_MS) {
    state.isOpen = false;
    state.failures = 0;
    return false;
  }

  return true;
}

export function recordSuccess(providerName: string) {
  circuitBreakers[providerName] = {
    failures: 0,
    lastFailureTime: 0,
    isOpen: false,
  };
}

export function recordFailure(providerName: string) {
  if (!circuitBreakers[providerName]) {
    circuitBreakers[providerName] = { failures: 0, lastFailureTime: 0, isOpen: false };
  }
  const state = circuitBreakers[providerName];
  state.failures += 1;
  state.lastFailureTime = Date.now();

  if (state.failures >= FAILURE_THRESHOLD) {
    state.isOpen = true;
    console.warn(
      `[Circuit Breaker] Provedor ${providerName} atingiu ${state.failures} falhas consecutivas. Circuito aberto por 60s.`
    );
  }
}

/**
 * Classifies whether an error is worth retrying (network blip, rate limit,
 * transient 5xx) versus permanent (bad request, auth failure, not found) where
 * retrying would just repeat the same failure `maxAttempts` times for nothing.
 *
 * Deliberately conservative for the boundary case: an error with no recognizable
 * status code AND no matching keyword returns `false` (not retried) rather than
 * `true`. An unrecognized permanent error (e.g. a malformed-request 4xx that
 * doesn't match the explicit list) is safer to surface immediately than to retry
 * blindly.
 *
 * @param error - Any thrown value; duck-typed for `.status` / `.statusCode` /
 *   `.response.status` / `.message`, so both SDK errors and plain fetch Response
 *   errors work without a shared error type.
 * @returns `true` if {@link executeWithRetry} should attempt another try.
 */
export function isTransientError(error: any): boolean {
  if (!error) return false;
  const errStr = String(error.message || error || '').toLowerCase();
  const status = error.status || error.statusCode || error.response?.status;

  // Non-transient HTTP status codes (Client errors)
  if (status && [400, 401, 403, 404, 422].includes(status)) {
    return false;
  }

  // Check for rate limits (429) or transient server errors (500, 502, 503, 504)
  if (
    status === 429 ||
    (status >= 500 && status <= 599) ||
    errStr.includes('429') ||
    errStr.includes('resource_exhausted') ||
    errStr.includes('quota') ||
    errStr.includes('rate limit') ||
    errStr.includes('timeout') ||
    errStr.includes('econnreset') ||
    errStr.includes('fetch failed')
  ) {
    return true;
  }

  return false;
}

/**
 * Runs `operation` with a per-attempt timeout, exponential backoff between
 * retries, and circuit-breaker short-circuiting. This is the single choke point
 * every outbound AI provider HTTP/SDK call in this codebase goes through.
 *
 * Control flow per attempt: a fresh `AbortController` is created and wired to
 * `operation` via its `signal` parameter — **`operation` must actually pass this
 * signal into its underlying fetch/SDK call**, or the timeout fires but nothing
 * is actually cancelled (the call keeps running in the background while this
 * function has already moved on to the next attempt / thrown). On timeout the
 * abort reason is rewritten into a Portuguese "Tempo limite excedido" message so
 * callers never have to special-case a raw `AbortError`.
 *
 * @param providerName - Identifies the circuit breaker bucket; use the same
 *   string consistently for one provider (`'gemini'` / `'opencode'`).
 * @param operation - The call to attempt. Receives the `AbortSignal` for this
 *   attempt; must forward it to the actual network call to make the timeout
 *   effective.
 * @param maxAttempts - Total attempts including the first (default 3).
 * @param timeoutMs - Per-attempt budget in ms (default 90000 — sized for chapter
 *   blocks generating up to 8192 output tokens; do not lower this without
 *   checking generation latency at max output length first).
 * @returns Whatever `operation` resolves with, on the attempt that succeeds.
 * @throws The last error encountered, once retries are exhausted, the error is
 *   classified non-transient by {@link isTransientError}, or the circuit for
 *   `providerName` is already open (in which case it throws immediately, before
 *   attempting anything, with a `[Circuit Breaker]`-prefixed message).
 */
export async function executeWithRetry<T>({
  providerName,
  operation,
  maxAttempts = 3,
  // A chapter block is generated with up to 8192 output tokens; 30s was not a
  // realistic budget for that and turned normal long completions into timeouts
  // (which then burned two more retries before surfacing).
  timeoutMs = 90000,
}: {
  providerName: string;
  operation: (signal: AbortSignal) => Promise<T>;
  maxAttempts?: number;
  timeoutMs?: number;
}): Promise<T> {
  if (isCircuitOpen(providerName)) {
    throw new Error(
      `[Circuit Breaker] O provedor ${providerName} está indisponível temporariamente devido a falhas recentes.`
    );
  }

  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await operation(controller.signal);
      clearTimeout(timeoutId);
      recordSuccess(providerName);
      return result;
    } catch (err: any) {
      clearTimeout(timeoutId);
      lastError = err;

      // Handle AbortSignal timeout
      if (err.name === 'AbortError' || controller.signal.aborted) {
        lastError = new Error(
          `Tempo limite de ${timeoutMs / 1000}s excedido na chamada para ${providerName}.`
        );
      }

      const retryable = isTransientError(lastError);

      if (retryable && attempt < maxAttempts) {
        // Calculate exponential backoff with jitter
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 10000);
        console.warn(
          `[AI Retry] Tentativa ${attempt}/${maxAttempts} para ${providerName} falhou (${lastError.message}). Aguardando ${Math.round(backoffMs)}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      } else {
        // Permanent error or max attempts reached
        recordFailure(providerName);
        throw lastError;
      }
    }
  }

  recordFailure(providerName);
  throw lastError;
}
