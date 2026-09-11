# Ryvax Docs Platform

A complete, open-source documentation platform starter built with **Ryvax.js only** as the application framework. It is intentionally designed for development and learning rather than production certification. The template provides public documentation pages, a server-rendered workspace, Supabase authentication and persistence, Stripe Checkout subscriptions, signed Stripe webhooks, a local demo mode, and deploy configuration for Vercel and GitHub Pages.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

When running this directory directly inside the upstream Ryvax monorepo, build the repository package first (`npm ci && npm run build`); the template intentionally uses `file:../..` so the example exercises the local framework. Projects created with `npx ryvax create my-docs --template=docs` are rewritten to use the published `@kvantjs/ryvax.js` package.

Open `http://localhost:3000`. With the default `DEV_DEMO_USER=true`, the workspace works against an in-memory development store. Configure Supabase and Stripe in `.env` when you want real authentication, persistence, and billing.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Public documentation landing page |
| `/docs/getting-started` | Static-compatible documentation page |
| `/docs/:slug` | Dynamic documentation page, backed by Supabase when configured |
| `/pricing` | Stripe subscription checkout entry point |
| `/login` and `/signup` | Supabase email/password authentication forms |
| `/workspace` | Authenticated document workspace |
| `/workspace/new` | Document creation form |
| `/api/auth/*` | Signup, login, logout, and callback handlers |
| `/api/documents` | Authenticated document API |
| `/api/billing/checkout` | Creates a Stripe Checkout subscription session |
| `/api/stripe/webhook` | Verifies and handles Stripe webhook events |
| `/api/health` | Health endpoint with integration status |

## Supabase setup

1. Create a Supabase project.
2. Copy the project URL and publishable key into `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; it is used only by the Stripe webhook to update subscription state.
4. Run [`supabase/migrations/0001_docs_platform.sql`](supabase/migrations/0001_docs_platform.sql) in the Supabase SQL editor.
5. Add `http://localhost:3000/api/auth/callback` and your deployed callback URL to the Supabase Auth redirect allow list.
6. Set `DEV_DEMO_USER=false` after real authentication is working.

## Stripe setup

1. Create a recurring test Price in Stripe and set `STRIPE_PRO_PRICE_ID`.
2. Set `STRIPE_SECRET_KEY` to a test-mode secret key.
3. Forward webhooks locally with `stripe listen --forward-to localhost:3000/api/stripe/webhook` and copy the reported signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Register `/api/stripe/webhook` in the Stripe Dashboard for the deployed app and subscribe to `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`.
5. Stripe must receive the raw request body. Ryvax exposes it as `RequestContext.rawBody` so the signature can be verified before parsing application data.

## Deploy to Vercel

The template uses Ryvax's Node.js Vercel Build Output adapter, not Next.js:

```bash
npm run build:vercel
npx vercel deploy --prebuilt
```

For Git integration, keep the `buildCommand` from `vercel.json`. Configure the same environment variables in the Vercel project. Vercel needs the server runtime for SSR, Supabase auth, and Stripe webhooks.

For a GitHub Actions deploy, configure repository secrets named `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`, then use the included `.github/workflows/vercel.yml`.

## Deploy to GitHub Pages

GitHub Pages can host the static public portion only. API routes, authentication, Stripe Checkout creation, and SSR workspace pages require the Node runtime and therefore belong on Vercel or another Node host. In the `kvantjs/ryvax.js` repository, the included workflow publishes the public template at `/ryvax.js/template/`; standalone copies should use the repository base path appropriate to their Pages site.

```bash
PUBLIC_BASE_PATH=/template npm run export -- --out-dir dist
```

The static export contains seeded documentation pages and the pricing page. It never contains secrets. The static build is a showcase/demo surface; use Vercel for the complete app.

## Security and production boundary

This starter is not a production security review. Use test Stripe keys during development, rotate all secrets, keep the service role key out of browser bundles, add rate limiting and abuse monitoring, review Supabase RLS policies, and add idempotency storage for webhook events before production use. Do not commit `.env`.

## License

MIT. Contributions are welcome through the upstream Ryvax.js repository.
