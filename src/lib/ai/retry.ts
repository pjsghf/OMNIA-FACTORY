export interface CircuitState {
  failures: number;
  lastFailureTime: number;
  isOpen: boolean;
}

const circuitBreakers: Record<string, CircuitState> = {};
const FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60000; // 60 seconds cooldown

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
    console.warn(`[Circuit Breaker] Provedor ${providerName} atingiu ${state.failures} falhas consecutivas. Circuito aberto por 60s.`);
  }
}

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

export async function executeWithRetry<T>({
  providerName,
  operation,
  maxAttempts = 3,
  timeoutMs = 30000,
}: {
  providerName: string;
  operation: (signal: AbortSignal) => Promise<T>;
  maxAttempts?: number;
  timeoutMs?: number;
}): Promise<T> {
  if (isCircuitOpen(providerName)) {
    throw new Error(`[Circuit Breaker] O provedor ${providerName} está indisponível temporariamente devido a falhas recentes.`);
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
        lastError = new Error(`Tempo limite de ${timeoutMs / 1000}s excedido na chamada para ${providerName}.`);
      }

      const retryable = isTransientError(lastError);

      if (retryable && attempt < maxAttempts) {
        // Calculate exponential backoff with jitter
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 10000);
        console.warn(`[AI Retry] Tentativa ${attempt}/${maxAttempts} para ${providerName} falhou (${lastError.message}). Aguardando ${Math.round(backoffMs)}ms...`);
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
