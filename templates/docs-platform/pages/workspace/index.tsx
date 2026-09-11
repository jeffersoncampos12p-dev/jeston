import type { PageModule, RequestContext } from '@kvantjs/ryvax.js';
import { Link } from '@kvantjs/ryvax.js/client';
import { DocumentList, Shell, WorkspaceHeader, appPath } from '../../src/site.js';
import { currentUser, listDocuments, setupStatus, type AppUser, type DocumentRecord } from '../../src/services.js';

type Props = { user: AppUser | null; documents: DocumentRecord[]; setup: ReturnType<typeof setupStatus> };

export const getServerSideProps = async (context: RequestContext): Promise<Props> => {
  const user = await currentUser(context);
  const documents = user ? await listDocuments(context, user.id) : [];
  return { user, documents, setup: setupStatus(context.env) };
};

const page: PageModule<Props> = {
  default({ user, documents, setup }) {
    if (!user) return <Shell active="workspace"><div className="auth-wrap"><div className="auth-card"><p className="eyebrow">Private workspace</p><h1>Sign in to write.</h1><p className="muted">Your documents live behind Supabase Auth.</p><Link className="button primary full" href={appPath('/login')}>Sign in <span>→</span></Link></div></div></Shell>;
    return <Shell active="workspace" user={user}><section className="workspace"><WorkspaceHeader user={user} /><div className="integration-strip"><span><i className={setup.supabase ? 'ready' : ''} /> Supabase {setup.supabase ? 'connected' : 'demo mode'}</span><span><i className={setup.stripe ? 'ready' : ''} /> Stripe {setup.stripe ? 'ready' : 'optional'}</span><span className="mode-label">{setup.mode}</span></div><div className="workspace-grid"><section className="workspace-panel"><div className="panel-head"><div><p className="eyebrow">Your library</p><h2>{documents.length} document{documents.length === 1 ? '' : 's'}</h2></div><Link className="button primary" href={appPath('/workspace/new')}>New document <span>+</span></Link></div>{documents.length ? <DocumentList documents={documents} /> : <div className="empty-state"><span>✦</span><h3>Your blank page is waiting.</h3><p>Create your first guide and make it public when it is ready.</p><Link href={appPath('/workspace/new')}>Create a document →</Link></div>}</section><aside className="workspace-aside"><p className="eyebrow">Next up</p><h3>Connect your stack.</h3><p>Copy the Supabase schema, add Stripe test keys, and keep building with a portable Node runtime.</p><Link href={appPath('/docs/integrations')}>Read integration guide →</Link></aside></div></section></Shell>;
  }
};

export default page.default;
