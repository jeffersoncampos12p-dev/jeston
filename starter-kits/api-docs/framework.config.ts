import type { AppConfig } from '@kvantjs/ryvax.js';

export default {
  poweredBy: false,
  cache: { enabled: true, defaultTtl: 0, staleWhileRevalidate: 60, maxEntries: 2_000 },
  observability: { requestId: true, requestLogging: false },
  limits: { bodyBytes: 2 * 1024 * 1024, requestTimeoutMs: 30_000, shutdownTimeoutMs: 10_000 },
  securityHeaders: {
    'Content-Security-Policy': [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.stripe.com",
      "connect-src 'self' https://*.supabase.co https://api.stripe.com",
      "frame-src https://checkout.stripe.com",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'"
    ].join('; '),
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  }
} satisfies AppConfig;

