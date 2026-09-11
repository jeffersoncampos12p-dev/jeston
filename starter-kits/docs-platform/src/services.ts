import { createServerClient, parseCookieHeader, serializeCookieHeader, type SetAllCookies } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RequestContext } from '@kvantjs/ryvax.js';

export type DocumentRecord = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  is_public: boolean;
  updated_at: string;
};

export type AppUser = { id: string; email: string | null; demo?: boolean };

const demoDocuments: DocumentRecord[] = [
  {
    id: 'demo-getting-started', owner_id: 'demo-user', slug: 'getting-started',
    title: 'Getting started', description: 'Ship your first documentation space with Ryvax.',
    content: 'Ryvax Docs is a server-rendered documentation starter. Connect Supabase for persistence, then add Stripe Billing when you are ready to monetize private workspaces.',
    is_public: true, updated_at: '2026-09-10T12:00:00.000Z'
  },
  {
    id: 'demo-routing', owner_id: 'demo-user', slug: 'routing',
    title: 'Routing and rendering', description: 'Use file-based routes with SSR and static export.',
    content: 'Pages live in pages/. API handlers live in pages/api/. Dynamic documentation pages use pages/docs/[slug].ts and remain compatible with Ryvax static export when getStaticPaths is provided.',
    is_public: true, updated_at: '2026-09-09T12:00:00.000Z'
  },
  {
    id: 'demo-integrations', owner_id: 'demo-user', slug: 'integrations',
    title: 'Supabase and Stripe', description: 'Keep credentials server-side and verify Stripe events.',
    content: 'The server creates a Supabase client from request cookies. Stripe Checkout sessions are created on the server, and webhook signatures are verified against RequestContext.rawBody before events are handled.',
    is_public: true, updated_at: '2026-09-08T12:00:00.000Z'
  }
];

export function siteUrl(env: Record<string, string | undefined>): string {
  return (env.SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function demoMode(env: Record<string, string | undefined>): boolean {
  return env.DEV_DEMO_USER === 'true' || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY;
}

export function createSupabase(context: RequestContext): SupabaseClient | null {
  const url = context.env.SUPABASE_URL;
  const key = context.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const makeClient = createServerClient as unknown as (supabaseUrl: string, supabaseKey: string, options: unknown) => SupabaseClient;
  return makeClient(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(typeof context.headers.cookie === 'string' ? context.headers.cookie : '');
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0], headers: Parameters<SetAllCookies>[1]) {
        const existing = context.response.getHeader('Set-Cookie');
        const cookies = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
        context.response.setHeader('Set-Cookie', [
          ...cookies,
          ...cookiesToSet.map(({ name, value, options }) => serializeCookieHeader(name, value, options))
        ]);
        for (const [name, value] of Object.entries(headers)) context.response.setHeader(name, value);
      }
    }
  });
}

export async function currentUser(context: RequestContext): Promise<AppUser | null> {
  if (demoMode(context.env)) return { id: 'demo-user', email: 'demo@ryvax.local', demo: true };
  const supabase = createSupabase(context);
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export function requireBodyRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export function formValue(body: unknown, key: string): string {
  if (typeof body === 'string') return new URLSearchParams(body).get(key)?.trim() ?? '';
  const record = requireBodyRecord(body);
  return typeof record[key] === 'string' ? record[key].trim() : '';
}

export async function listDocuments(context: RequestContext, ownerId: string): Promise<DocumentRecord[]> {
  if (demoMode(context.env)) return demoDocuments.filter((document) => document.owner_id === ownerId);
  const supabase = createSupabase(context);
  if (!supabase) return [];
  const { data, error } = await supabase.from('documents').select('*').eq('owner_id', ownerId).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentRecord[];
}

export async function findPublicDocument(context: RequestContext, slug: string): Promise<DocumentRecord | null> {
  const local = demoDocuments.find((document) => document.slug === slug && document.is_public);
  if (demoMode(context.env)) return local ?? null;
  const supabase = createSupabase(context);
  if (!supabase) return local ?? null;
  const { data } = await supabase.from('documents').select('*').eq('slug', slug).eq('is_public', true).maybeSingle();
  return (data as DocumentRecord | null) ?? local ?? null;
}

export async function createDocument(context: RequestContext, ownerId: string, input: Record<string, unknown>): Promise<DocumentRecord> {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') : '';
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const content = typeof input.content === 'string' ? input.content.trim() : '';
  if (title.length < 3 || slug.length < 3 || content.length < 3) throw new Error('Title, slug, and content are required.');
  if (demoMode(context.env)) {
    const document: DocumentRecord = { id: `demo-${Date.now()}`, owner_id: ownerId, slug, title, description, content, is_public: false, updated_at: new Date().toISOString() };
    demoDocuments.unshift(document);
    return document;
  }
  const supabase = createSupabase(context);
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('documents').insert({ owner_id: ownerId, slug, title, description, content, is_public: false }).select('*').single();
  if (error) throw error;
  return data as DocumentRecord;
}

export function setupStatus(env: Record<string, string | undefined>) {
  return {
    supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY),
    stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRO_PRICE_ID),
    mode: demoMode(env) ? 'demo' : 'connected'
  } as const;
}
