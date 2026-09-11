import type { PageModule } from '@kvantjs/ryvax.js';
import { appPath } from '../src/site.js';

export const getStaticProps = async () => ({});

const page: PageModule = {
  default() {
    return <html lang="en"><head><meta charSet="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="theme-color" content="#f7f7f5" /><link rel="stylesheet" href={appPath('/styles.css')} /><title>Ryvax Docs · Workspace</title></head><body><div id="saas-root"><div className="saas-loading"><span className="brand-mark">R</span><strong>Loading your workspace…</strong><small>Ryvax Docs</small></div></div><script type="module" src={appPath('/client.js')} /></body></html>;
  }
};

export default page.default;
