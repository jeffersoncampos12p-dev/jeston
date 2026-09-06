# Contribuindo com Jeston

O Jeston é um projeto open source mantido pela Hedron. Contribuições devem preservar compatibilidade, segurança e clareza da API pública.

## Fluxo

1. Abra uma issue para mudanças grandes ou bugs de segurança.
2. Crie uma branch curta a partir de `main`.
3. Adicione testes que reproduzam o comportamento.
4. Execute `npm run typecheck`, `npm test` e `npm run build`.
5. Atualize README, changelog ou documentação quando a API mudar.
6. Abra um pull request descrevendo impacto, compatibilidade e plano de migração.

## Critérios

O core deve permanecer pequeno, tipado e independente de provedores. Integrações específicas devem ser adapters ou pacotes oficiais separados. Não introduza breaking changes em uma versão minor. Mudanças incompatíveis exigem major version, nota de migração e revisão dos exemplos.

## Pull requests

Descreva o problema, a solução, os testes executados e os riscos conhecidos. Evite incluir segredos, dependências desnecessárias ou benchmarks não reproduzíveis.
