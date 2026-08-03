import helmet from 'helmet';
import { RequestHandler } from 'express';

/**
 * Enterprise Security Headers & Content Security Policy (CSP) Configuration
 */
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
        connectSrc: ["'self'", 'https://generativelanguage.googleapis.com', 'https://*'],
        frameAncestors: ["'self'", 'https://*', 'http://*'], // Allows embedding in AI Studio preview iframe
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
