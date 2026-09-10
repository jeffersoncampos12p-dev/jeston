import type { AppConfig } from 'ryvax';

export default {
  poweredBy: false,
  cache: { enabled: true, defaultTtl: 30, staleWhileRevalidate: 60 },
  securityHeaders: {
    'Content-Security-Policy': "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'"
  }
} satisfies AppConfig;
