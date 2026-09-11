import type { ReactNode } from 'react';
import { Link } from '@kvantjs/ryvax.js/client';
import type { DocumentRecord, AppUser } from './services.js';

export function appPath(path: string): string {
  if (!path.startsWith('/')) return path;
  const prefix = typeof process !== 'undefined' && process.env?.PUBLIC_BASE_PATH ? process.env.PUBLIC_BASE_PATH.replace(/\/$/, '') : '';
  return `${prefix}${path}` || '/';
}

export function Shell({ children, active = 'docs', user }: { children: ReactNode; active?: string; user?: AppUser | null }) {
  return <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#f6f4ef" /><link rel="stylesheet" href={appPath('/styles.css')} /><title>Ryvax Docs</title></head><body><header className="topbar"><Link className="brand" href={appPath('/')}><span className="brand-mark">R</span><span>Ryvax Docs</span></Link><nav><Link className={active === 'docs' ? 'active' : ''} href={appPath('/docs/getting-started')}>Docs</Link><Link className={active === 'pricing' ? 'active' : ''} href={appPath('/pricing')}>Pricing</Link><Link className="workspace-cta" href={appPath('/app')}>Open workspace ↗</Link>{user ? <Link className={active === 'workspace' ? 'active' : ''} href={appPath('/workspace')}>Workspace</Link> : <Link className="nav-cta" href={appPath('/login')}>Sign in</Link>}</nav></header><main>{children}</main><footer><span>Open source · MIT</span><span>Built with <a href="https://github.com/kvantjs/ryvax.js">Ryvax.js</a></span></footer></body></html>;
}

export function DocsLayout({ children, activeSlug = 'getting-started' }: { children: ReactNode; activeSlug?: string }) {
  return <div className="docs-layout"><aside className="docs-sidebar"><p className="eyebrow">Documentation</p><h2>Build in public.</h2><p className="muted">A calm, portable home for your product knowledge.</p><div className="side-links"><Link href={appPath('/docs/getting-started')} className={activeSlug === 'getting-started' ? 'selected' : ''}>Getting started</Link><Link href={appPath('/docs/routing')} className={activeSlug === 'routing' ? 'selected' : ''}>Routing and rendering</Link><Link href={appPath('/docs/integrations')} className={activeSlug === 'integrations' ? 'selected' : ''}>Supabase and Stripe</Link></div><Link className="side-bottom" href={appPath('/workspace')}>Open workspace <span>↗</span></Link></aside><section className="doc-content">{children}</section></div>;
}

export function DocumentArticle({ document }: { document: DocumentRecord }) {
  const paragraphs = document.content.split(/\n\s*\n/).filter(Boolean);
  return <article className="article"><p className="eyebrow">Guide · 6 min read</p><h1>{document.title}</h1><p className="lede">{document.description}</p>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}<div className="article-foot"><span>Last updated {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(document.updated_at))}</span><a href="https://github.com/kvantjs/ryvax.js">Edit on GitHub ↗</a></div></article>;
}

export function AuthCard({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  return <div className="auth-wrap"><div className="auth-card"><p className="eyebrow">Ryvax Docs</p><h1>{signup ? 'Create your workspace.' : 'Welcome back.'}</h1><p className="muted">{signup ? 'Start writing docs with Supabase auth ready to go.' : 'Sign in to manage your documentation workspace.'}</p><form method="post" action={appPath(signup ? '/api/auth/signup' : '/api/auth/login')}><label>Email<input type="email" name="email" required autoComplete="email" placeholder="you@example.com" /></label><label>Password<input type="password" name="password" required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} placeholder="At least 8 characters" /></label><button className="button primary" type="submit">{signup ? 'Create account' : 'Sign in'} <span>→</span></button></form><p className="auth-switch">{signup ? 'Already have an account?' : 'New to Ryvax Docs?'} <Link href={appPath(signup ? '/login' : '/signup')}>{signup ? 'Sign in' : 'Create an account'}</Link></p></div></div>;
}

export function DocumentList({ documents }: { documents: DocumentRecord[] }) {
  return <div className="document-list">{documents.map((document) => <Link key={document.id} href={appPath(`/docs/${document.slug}`)} className="document-row"><span className="doc-icon">#</span><span><strong>{document.title}</strong><small>{document.description || 'No description yet.'}</small></span><span className="arrow">↗</span></Link>)}</div>;
}

export function WorkspaceHeader({ user }: { user: AppUser }) {
  return <div className="workspace-head"><div><p className="eyebrow">Private workspace</p><h1>Welcome, {user.email?.split('@')[0] ?? 'writer'}.</h1><p className="muted">Draft, organize, and publish your next documentation space.</p></div><form method="post" action={appPath('/api/auth/logout')}><button className="button ghost" type="submit">Sign out</button></form></div>;
}
