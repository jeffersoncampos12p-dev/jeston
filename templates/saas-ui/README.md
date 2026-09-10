# Ryvax SaaS UI Starter Kit

An open-source, production-minded SaaS dashboard starter built with [Ryvax](https://github.com/kvantjs/ryvax.js). It provides a responsive workspace shell, metrics, project tracking, activity feed, project detail pages, and JSON API routes that can be replaced with a database or authentication provider.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The starter intentionally uses realistic seeded data so the interface is useful immediately, while keeping all application code in the repository and easy to replace.

## Included routes

| Route | Purpose |
| --- | --- |
| `/` | Workspace overview with metrics, projects, activity, and responsive navigation |
| `/projects/:id` | Static project detail view generated with `getStaticPaths` |
| `/api/projects` | JSON project collection for dashboard integrations |
| `/api/health` | Health endpoint suitable for uptime checks |

## Customization

- Replace the seeded data in `pages/index.ts` and `pages/projects/[id].ts` with SQL queries or your application services.
- Add authentication and authorization in Ryvax middleware before exposing workspace data.
- Extend `public/styles.css` with your brand tokens, or swap it for your design system.
- Use `framework.config.ts` as the place for security headers, cache policy, and runtime configuration.

This starter is released under the MIT license. It is a UI and application foundation, not a hosted service or a substitute for production identity, billing, or data access controls.
