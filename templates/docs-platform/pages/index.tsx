import type { PageModule } from '@kvantjs/ryvax.js';
import { Link } from '@kvantjs/ryvax.js/client';
import { Shell, appPath } from '../src/site.js';

export const getStaticProps = async () => ({});

const page: PageModule = {
  default() {
    return <Shell><section className="hero"><div className="hero-copy"><p className="eyebrow">Ryvax Docs · open source template</p><h1>Documentation that feels like a product.</h1><p className="hero-lede">A full-stack starting point for teams that want beautiful public docs, a private editor, Supabase auth, and Stripe subscriptions without giving up portability.</p><div className="hero-actions"><Link className="button primary" href={appPath('/docs/getting-started')}>Read the docs <span>→</span></Link><Link className="button ghost" href={appPath('/signup')}>Create a workspace</Link></div><p className="hero-note"><span className="status-dot" /> Demo mode works locally. Connect services when you are ready.</p></div><div className="hero-preview"><div className="preview-top"><span className="window-dot coral" /><span className="window-dot yellow" /><span className="window-dot green" /><span className="preview-url">docs.yourproduct.com</span></div><div className="preview-body"><aside><div className="mini-brand">Ryvax Docs</div><span className="mini-label">GUIDES</span><b>Getting started</b><span>Routing</span><span>Integrations</span></aside><div className="preview-article"><span className="mini-kicker">GUIDE · 6 MIN READ</span><h3>Build in public.</h3><p>A calm, portable home for your product knowledge.</p><div className="fake-line long" /><div className="fake-line" /><div className="fake-line medium" /></div></div></div></section><section className="feature-grid"><div><span className="feature-number">01</span><h2>Write once.</h2><p>Organize public guides and private drafts with file-based routes and a clear content model.</p></div><div><span className="feature-number">02</span><h2>Own the stack.</h2><p>Ryvax controls routing, SSR, static export, APIs, security headers, and the deploy artifact.</p></div><div><span className="feature-number">03</span><h2>Grow safely.</h2><p>Supabase and Stripe integrations are explicit, server-side, and easy to replace or extend.</p></div></section></Shell>;
  }
};

export default page.default;
