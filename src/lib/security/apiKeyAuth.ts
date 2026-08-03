import { RequestHandler } from 'express';
import { timingSafeEqual } from 'crypto';

/**
 * Optional shared-secret gate for the /api surface.
 *
 * Every endpoint is unauthenticated by default, and each one spends the server's
 * GEMINI_API_KEY on the caller's behalf. That is fine for a single-user local run
 * and wrong for anything reachable from the internet, where an open endpoint is
 * someone else's AI budget.
 *
 * Proper multi-user auth is a product decision (accounts? per-user keys? SSO?), so
 * this deliberately does not make it. It only closes the "deployed and wide open"
 * case: set API_ACCESS_TOKEN and callers must present it. Unset -- the default --
 * leaves behaviour exactly as before.
 */
export function createApiAuthMiddleware(): RequestHandler {
  const expectedToken = (process.env.API_ACCESS_TOKEN || '').trim();

  if (!expectedToken) {
    return (_req, _res, next) => next();
  }

  // Public endpoints: a health probe that needs a credential is not a health probe.
  const PUBLIC_PATHS = new Set(['/health', '/ready', '/privacy-policy']);

  return (req, res, next) => {
    if (PUBLIC_PATHS.has(req.path)) return next();

    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
    const provided = (bearer || (req.headers['x-api-key'] as string) || '').trim();

    if (!provided || !safeCompare(provided, expectedToken)) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Credencial de acesso ausente ou inválida.',
        },
      });
    }

    return next();
  };
}

/** Constant-time compare, so a wrong token cannot be recovered by timing. */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on length mismatch, which would itself leak the length.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
