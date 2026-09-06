# Contrato de compatibilidade Jeston 1.x

A partir do Jeston 1.0.0, os exports documentados em `@hedronjs/jeston` e `@hedronjs/jeston/client` seguem versionamento semântico. Uma versão minor pode adicionar APIs; não pode remover ou alterar o significado de uma API documentada. Correções de bug e patches de segurança entram em versões patch.

## API estável

São estáveis o `PageModule`, `ApiHandler`, `RequestContext`, `ResponseLike`, `AppConfig`, `DatabaseAdapter`, o renderer React, `hydrate`, `mount`, `createSessionToken`, `verifySessionToken`, `createCsrfToken`, `verifyCsrfToken`, os contratos SQL (`SqlClient`, `sql`, `identifier`) e as interfaces de plataforma (`CacheAdapter`, `JobQueue`, `StorageAdapter`, `MetricsAdapter`, `createHealthRegistry`).

## Depreciações

Uma API será marcada como deprecated por pelo menos uma major quando houver substituição. A documentação explicará a alternativa, a versão de início e a versão planejada de remoção. APIs internas em `dist` que não aparecem na documentação não são contrato público.

## Segurança

Patches de segurança podem ser publicados imediatamente. A Hedron não garante ausência de vulnerabilidades; garante processo de reporte privado, análise, correção e comunicação responsável conforme `SECURITY.md`.

## Suporte

A linha 1.x tem como alvo Node.js LTS suportado pela matriz de CI do repositório. Cada release deve publicar changelog, testes, artefato npm e notas de migração quando necessário.
