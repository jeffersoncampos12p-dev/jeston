export interface SitemapEntry { url: string; lastModified?: string | Date; changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'; priority?: number; }

export function renderSitemap(entries: SitemapEntry[]): string {
  const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map((entry) => `<url><loc>${escape(entry.url)}</loc>${entry.lastModified ? `<lastmod>${new Date(entry.lastModified).toISOString()}</lastmod>` : ''}${entry.changeFrequency ? `<changefreq>${entry.changeFrequency}</changefreq>` : ''}${entry.priority !== undefined ? `<priority>${Math.max(0, Math.min(1, entry.priority))}</priority>` : ''}</url>`).join('')}</urlset>`;
}

export interface RobotsPolicy { userAgent?: string; allow?: string[]; disallow?: string[]; sitemap?: string; }
export function renderRobots(policy: RobotsPolicy = {}): string {
  const lines = [`User-agent: ${policy.userAgent ?? '*'}`, ...(policy.allow ?? []).map((value) => `Allow: ${value}`), ...(policy.disallow ?? []).map((value) => `Disallow: ${value}`), ...(policy.sitemap ? [`Sitemap: ${policy.sitemap}`] : [])];
  return `${lines.join('\n')}\n`;
}

export function seoFiles(options: { sitemap?: SitemapEntry[]; robots?: RobotsPolicy; manifest?: WebAppManifest }): Record<string, string> {
  return {
    ...(options.sitemap ? { 'sitemap.xml': renderSitemap(options.sitemap) } : {}),
    ...(options.robots ? { 'robots.txt': renderRobots(options.robots) } : {}),
    ...(options.manifest ? { 'manifest.webmanifest': renderWebAppManifest(options.manifest) } : {})
  };
}

export interface WebAppManifest { name: string; short_name?: string; start_url?: string; display?: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser'; theme_color?: string; background_color?: string; icons?: Array<{ src: string; sizes: string; type: string }> }
export function renderWebAppManifest(manifest: WebAppManifest): string { return JSON.stringify(manifest, null, 2) + '\n'; }

export function preloadFont(href: string, type = 'font/woff2'): string { return `<link rel="preload" href="${escapeAttribute(href)}" as="font" type="${escapeAttribute(type)}" crossorigin>`; }
function escapeAttribute(value: string): string { return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!)); }
