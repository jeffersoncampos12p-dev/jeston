import { createElement, type ReactNode } from 'react';
import { assertSafeUrl } from './security.js';

export interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  placeholder?: 'empty' | 'blur';
  blurDataURL?: string;
  className?: string;
}

export function Image({ src, alt, width, height, sizes, priority = false, placeholder = 'empty', blurDataURL, className }: ImageProps): ReactNode {
  return createElement('img', {
    src, alt, width, height, sizes, className,
    loading: priority ? 'eager' : 'lazy',
    decoding: 'async',
    fetchPriority: priority ? 'high' : 'auto',
    ...(placeholder === 'blur' && blurDataURL ? { style: { backgroundImage: `url(${JSON.stringify(blurDataURL)})`, backgroundSize: 'cover' } } : {})
  });
}

export interface RemoteImagePolicy { allowedHosts: string[]; allowedProtocols?: string[]; }

export function assertAllowedImageUrl(src: string, policy: RemoteImagePolicy): URL {
  const url = assertSafeUrl(src, { allowedHosts: policy.allowedHosts, allowedProtocols: policy.allowedProtocols ?? ['https:'] });
  return url;
}

export interface Metadata {
  title?: string;
  description?: string;
  canonical?: string;
  openGraph?: { title?: string; description?: string; image?: string; type?: string };
  twitter?: { card?: string; title?: string; image?: string };
  alternates?: Record<string, string>;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
}

export function renderMetadata(metadata: Metadata): string {
  const tags: string[] = [];
  if (metadata.title) tags.push(`<title>${escapeHtml(metadata.title)}</title>`);
  if (metadata.description) tags.push(`<meta name="description" content="${escapeHtml(metadata.description)}">`);
  if (metadata.canonical) tags.push(`<link rel="canonical" href="${escapeHtml(metadata.canonical)}">`);
  for (const [key, value] of Object.entries(metadata.alternates ?? {})) tags.push(`<link rel="alternate" hreflang="${escapeHtml(key)}" href="${escapeHtml(value)}">`);
  for (const [key, value] of Object.entries(metadata.openGraph ?? {})) if (value) tags.push(`<meta property="og:${escapeHtml(key)}" content="${escapeHtml(value)}">`);
  for (const [key, value] of Object.entries(metadata.twitter ?? {})) if (value) tags.push(`<meta name="twitter:${escapeHtml(key)}" content="${escapeHtml(value)}">`);
  return tags.join('');
}

export function jsonLd(value: unknown): string {
  const json = JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<script type="application/ld+json">${json}</script>`;
}

export interface ScriptProps { src: string; strategy?: 'beforeInteractive' | 'afterInteractive' | 'lazyOnload'; integrity?: string; nonce?: string; }

export function Script({ src, strategy = 'afterInteractive', integrity, nonce }: ScriptProps): ReactNode {
  return createElement('script', { src, defer: strategy !== 'beforeInteractive', async: strategy === 'lazyOnload', integrity, nonce });
}
