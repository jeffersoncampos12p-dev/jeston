import type { PageModule } from '@kvantjs/ryvax.js';
import { Link } from '@kvantjs/ryvax.js/client';
import { Shell, appPath } from '../src/site.js';

const page: PageModule = {
  default() {
    return <Shell active="pricing"><section className="pricing-page"><div className="center-heading"><p className="eyebrow">Simple billing</p><h1>Choose your writing room.</h1><p className="lede">Use Stripe Checkout for a real test subscription, or keep the local demo running for free.</p></div><div className="pricing-grid"><article className="price-card"><p className="eyebrow">Starter</p><h2>Free</h2><p className="price-copy">Explore the public docs and build locally with seeded demo data.</p><ul><li>Public documentation</li><li>Local demo workspace</li><li>Ryvax SSR and static export</li></ul><Link className="button ghost full" href={appPath('/docs/getting-started')}>Read the docs</Link></article><article className="price-card featured"><span className="popular">For product teams</span><p className="eyebrow">Pro workspace</p><h2>$19 <small>/ month</small></h2><p className="price-copy">Connect Supabase, publish private drafts, and test recurring billing through Stripe.</p><ul><li>Authenticated workspace</li><li>Supabase document persistence</li><li>Stripe subscription Checkout</li></ul><form method="post" action={appPath('/api/billing/checkout')}><input type="hidden" name="plan" value="pro" /><button className="button primary full" type="submit">Start with Stripe <span>→</span></button></form></article></div><p className="pricing-note">Test mode only. No card details are handled by this app.</p></section></Shell>;
  }
};

export default page.default;
