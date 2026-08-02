/**
 * Structured Logger with Redaction, Metrics & Request Tracing
 */

export interface LogContext {
  requestId?: string;
  projectId?: string;
  userId?: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  costUsd?: number;
  durationMs?: number;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = ['apiKey', 'authorization', 'token', 'secret', 'geminiApiKey', 'key', 'password'];

function redactSensitiveData(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Redact API key strings if detected
    if (obj.startsWith('AIzaSy') || obj.startsWith('Bearer ')) {
      return '[REDACTED]';
    }
    return obj;
  }
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const redacted: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactSensitiveData(value);
    }
  }
  return redacted;
}

export class StructuredLogger {
  private formatLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, context: LogContext = {}) {
    const timestamp = new Date().toISOString();
    const safeContext = redactSensitiveData(context);
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...safeContext,
    });
  }

  info(message: string, context?: LogContext) {
    console.log(this.formatLog('INFO', message, context));
  }

  warn(message: string, context?: LogContext) {
    console.warn(this.formatLog('WARN', message, context));
  }

  error(message: string, context?: LogContext) {
    console.error(this.formatLog('ERROR', message, context));
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(this.formatLog('DEBUG', message, context));
    }
  }

  metric(metricName: string, value: number, unit: string, context?: LogContext) {
    console.log(
      this.formatLog('INFO', `METRIC: ${metricName}=${value}${unit}`, {
        metricName,
        value,
        unit,
        ...context,
      })
    );
  }
}

export const logger = new StructuredLogger();
