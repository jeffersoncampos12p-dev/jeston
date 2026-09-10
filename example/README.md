# Pulseboard example

Pulseboard is a small Ryvax example application. It demonstrates a server-rendered dashboard, a dynamic project route, API health endpoints, security headers, and static export.

## Run locally

```bash
npm install
npm run dev
```

For production:

```bash
npm run build
npm run start -- --port 4173
```

## Deploy to Netlify

The repository includes `netlify.toml` and a versioned framework copy under `framework/`. This keeps the build independent of an unpublished package or a parent directory that is not present in a Netlify checkout. The static configuration runs `npm run export` and publishes `dist/`.

Use an empty Base directory, `npm run export` as the Build command, and `dist` as the Publish directory. For SSR and API routes, use `npm run deploy` on a platform with a Node.js runtime and start `node dist/server.mjs`.

## Routes

| Route | Description |
| --- | --- |
| `/` | Server-rendered Pulseboard dashboard |
| `/projects/atlas-mobile` | Project detail with a dynamic parameter |
| `/api/health` | Service health check |
| `/api/projects` | Project data as JSON |

The visual direction uses an ivory surface, coral actions, Manrope typography, DM Mono details, lightweight cards, and an asymmetric grid.
