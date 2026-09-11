import type { PageModule, RequestContext } from '@kvantjs/ryvax.js';
import { DocsLayout, DocumentArticle, Shell } from '../../src/site.js';
import { findPublicDocument, type DocumentRecord } from '../../src/services.js';

const slugs = ['getting-started', 'routing', 'integrations'];
type Props = { document: DocumentRecord | null; slug: string };

export const getStaticPaths = async () => slugs.map((slug) => ({ slug }));

export const getStaticProps = async (context?: RequestContext): Promise<Props> => {
  const slug = String(context?.params.slug ?? 'getting-started');
  const document = context ? await findPublicDocument(context, slug) : null;
  return { document, slug };
};

const page: PageModule<Props> = {
  default({ document, slug }) {
    return <Shell><DocsLayout activeSlug={slug}>{document ? <DocumentArticle document={document} /> : <article className="article"><p className="eyebrow">Not found</p><h1>This guide is not published.</h1><p className="lede">Create it in your workspace, or return to the getting started guide.</p></article>}</DocsLayout></Shell>;
  }
};

export default page.default;

