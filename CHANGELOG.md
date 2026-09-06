# Changelog

## [Unreleased]

## [1.0.0] - 2026-09-06

- API pública documentada com contrato de compatibilidade SemVer.
- SQL parameterizado com adapters PostgreSQL/SQLite.
- Autorização por roles/permissões e rate limiting local.
- Health/readiness registry e contratos para cache, jobs, storage e métricas.
- Core React full-stack, SSR, SSG, streaming, auth e segurança de produção.

## [0.4.0] - 2026-09-06

- Limite de body configurável, com resposta HTTP 413 para payload excedente.
- Timeout de request configurável no servidor Node.
- Sessões assinadas com HMAC SHA-256, cookies seguros e tokens CSRF.
- Starter SaaS na CLI com endpoint de sessão tipado.
- Matriz CI para Node.js 20, 22 e 24 com auditoria de dependências.
- Política de segurança, contribuição, código de conduta, adapters e roadmap.

## [0.3.0] - 2026-09-06

- React-first com SSR, SSG e hidratação.
- Streaming SSR com `renderToPipeableStream`.
- Helpers `hydrate` e `mount` em `@hedronjs/jeston/client`.
- CLI com template React completo.
- Benchmark React reproduzível contra Next.js Pages Router.

[Unreleased]: https://github.com/jeffersoncampos12p-dev/jeston/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v1.0.0
[0.4.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v0.4.0
[0.3.0]: https://github.com/jeffersoncampos12p-dev/jeston/releases/tag/v0.3.0
