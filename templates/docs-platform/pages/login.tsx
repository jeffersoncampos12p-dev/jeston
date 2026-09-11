import type { PageModule } from '@kvantjs/ryvax.js';
import { AuthCard } from '../src/site.js';

export const getStaticProps = async () => ({});

const page: PageModule = { default() { return <AuthCard mode="login" />; } };
export default page.default;
