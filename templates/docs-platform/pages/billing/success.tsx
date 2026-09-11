import type { PageModule } from '@kvantjs/ryvax.js';
import { Link } from '@kvantjs/ryvax.js/client';
import { Shell, appPath } from '../../src/site.js';

export const getStaticProps = async () => ({});

const page: PageModule = { default() { return <Shell><section className="success-page"><span className="success-icon">✓</span><p className="eyebrow">Checkout complete</p><h1>Thanks for supporting the docs.</h1><p className="lede">Stripe will notify the webhook endpoint, and your workspace subscription status can be synchronized from there.</p><Link className="button primary" href={appPath('/workspace')}>Go to workspace <span>→</span></Link></section></Shell>; } };
export default page.default;
