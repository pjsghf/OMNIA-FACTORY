import rateLimit from 'express-rate-limit';

/**
 * Distributed Rate Limiter & Cost Budget Protection
 */
export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 300, // Limit each IP to 300 requests per 15 min window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error:
      'Muitas requisições enviadas ao servidor OMNIA. Por favor aguarde alguns minutos antes de tentar novamente.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

export const editorialAiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // Limit AI generation requests to 30 per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Limite de chamadas concorrentes da IA atingido. Por favor aguarde 60 segundos.',
    code: 'AI_RATE_LIMIT_EXCEEDED',
  },
});
