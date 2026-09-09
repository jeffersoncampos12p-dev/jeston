# Deployment compatibility matrix

| Target | Runtime | Streaming | Filesystem | Cache | Cron | WebSocket | Environment |
|---|---|---:|---|---|---:|---:|---|
| Node | Node 20+ | yes | persistent | local/adapter | yes | yes | process |
| Docker | Node 20+ | yes | ephemeral/container | local/adapter | external | yes | both |
| Cloudflare Workers | edge | yes | none | platform | no | no | bindings |
| Vercel | Node/edge | target-dependent | ephemeral | platform | platform | target-dependent | both |
| Netlify | Node/edge | target-dependent | ephemeral | platform | platform | target-dependent | both |
| Cloud Run | Node 20+ | yes | ephemeral | adapter | external | yes | both |

The build must validate requested capabilities against the selected adapter. “Supported” means the contract is explicit; it does not replace provider-specific quotas, billing, or integration tests in the target account.
