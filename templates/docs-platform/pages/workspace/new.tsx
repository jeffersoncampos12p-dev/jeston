import type { PageModule, RequestContext } from '@kvantjs/ryvax.js';
import { Link } from '@kvantjs/ryvax.js/client';
import { Shell, appPath } from '../../src/site.js';
import { currentUser } from '../../src/services.js';

const page: PageModule<{ signedIn: boolean }> = {
  getServerSideProps: async (context: RequestContext) => ({ signedIn: Boolean(await currentUser(context)) }),
  default({ signedIn }) {
    if (!signedIn) return <Shell active="workspace"><div className="auth-wrap"><div className="auth-card"><p className="eyebrow">Workspace</p><h1>Sign in to create.</h1><Link className="button primary full" href={appPath('/login')}>Sign in <span>→</span></Link></div></div></Shell>;
    return <Shell active="workspace"><section className="editor-page"><Link className="back-link" href={appPath('/workspace')}>← Back to workspace</Link><div className="editor-heading"><p className="eyebrow">New document</p><h1>Give your idea a home.</h1><p className="lede">The form posts to a Ryvax API route and persists to Supabase when configured.</p></div><form className="editor-form" method="post" action={appPath('/api/documents')}><label>Title<input name="title" required minLength={3} placeholder="e.g. Getting started" /></label><label>Slug<input name="slug" required minLength={3} pattern="[a-z0-9-]+" placeholder="getting-started" /></label><label>Short description<input name="description" placeholder="What will readers learn?" /></label><label>Content<textarea name="content" required minLength={3} rows={9} placeholder="Write the first version of your guide..." /></label><div className="form-actions"><Link className="button ghost" href={appPath('/workspace')}>Cancel</Link><button className="button primary" type="submit">Save draft <span>→</span></button></div></form></section></Shell>;
  }
};

export default page.default;
