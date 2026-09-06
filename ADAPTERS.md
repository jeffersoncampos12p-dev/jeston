# Arquitetura de adapters

O Jeston mantém o runtime, roteamento, SSR, API, segurança e contratos TypeScript no pacote `@hedronjs/jeston`. Integrações externas devem viver em adapters versionados e independentes, reduzindo o risco de uma dependência de provedor quebrar todas as aplicações.

| Área | Pacote planejado | Responsabilidade |
| --- | --- | --- |
| Auth | `@hedronjs/jeston-auth` | sessões, OAuth/OIDC, MFA e autorização |
| Database | `@hedronjs/jeston-db` | PostgreSQL, Prisma, Drizzle e transações |
| Cache | `@hedronjs/jeston-redis` | cache distribuído, locks e rate limiting |
| Storage | `@hedronjs/jeston-storage` | S3, R2, Supabase Storage e uploads |
| Jobs | `@hedronjs/jeston-jobs` | filas, retries, idempotência e cron |
| Observability | `@hedronjs/jeston-observability` | métricas, tracing, logs e health checks |
| Payments | `@hedronjs/jeston-payments` | Stripe, webhooks e idempotência |

Cada adapter deve declarar sua matriz de Node, dependências peer, política de segurança, testes de integração e estratégia de migração. O core não deve importar SDKs de fornecedores diretamente. Isso permite que aplicações escolham PostgreSQL ou outro backend sem carregar milhares de dependências desnecessárias.

A Hedron deverá publicar adapters oficiais somente quando houver testes, documentação e manutenção definidos. Adapters comunitários devem poder seguir os mesmos contratos sem depender de APIs internas.
