import helmet from 'helmet';
import { RequestHandler } from 'express';

/**
 * Enterprise Security Headers & Content Security Policy (CSP) Configuration
 */
/**
 * Origins allowed to embed the app in an iframe (AI Studio preview, etc).
 * Set FRAME_ANCESTORS to a space-separated list to override.
 *
 * The previous value was ['self', 'https://*', 'http://*'], which is the same as
 * having no frame-ancestors policy at all: any site could iframe the studio and
 * clickjack it. Same reasoning for connectSrc, which allowed 'https://*'.
 */
function getFrameAncestors(): string[] {
  const configured = (process.env.FRAME_ANCESTORS || '').trim();
  if (configured) {
    return ["'self'", ...configured.split(/\s+/)];
  }
  return ["'self'", 'https://aistudio.google.com', 'https://*.google.com'];
}

function getConnectSources(): string[] {
  const extra = (process.env.EXTRA_CONNECT_SRC || '').trim();
  const base = [
    "'self'",
    'https://generativelanguage.googleapis.com',
    'https://opencode.ai',
  ];
  return extra ? [...base, ...extra.split(/\s+/)] : base;
}

export function createSecurityHeadersMiddleware(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Vite SPA inline client script bundles in dev/preview
          "'unsafe-eval'",
          'https://cdn.jsdelivr.net',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'", // Required for Tailwind CSS & inline SVG styling
          'https://fonts.googleapis.com',
        ],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: getConnectSources(),
        frameAncestors: getFrameAncestors(),
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // Disabled for cross-origin image assets in canvas
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    hsts:
      process.env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
    noSniff: true,
    xssFilter: true,
  });
}
