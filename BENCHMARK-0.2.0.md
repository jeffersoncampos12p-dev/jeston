# Benchmark Jeston 0.2.0 vs. Next.js 16.3.4

## Conclusão

A versão 0.2.0 do Jeston reduz o custo do caminho quente do servidor sem remover SSR, SSG, API routes, middleware, cache HTTP, cabeçalhos de segurança ou observabilidade configurável. No mesmo app mínimo usado no benchmark anterior, o Jeston otimizado atingiu **5.250 RPS em SSR HTML**, contra **801 RPS do Next.js Pages Router**, e **5.225 RPS na API JSON**, contra **2.078 RPS do Next.js**.

A comparação continua sendo um microbenchmark. Ela demonstra o comportamento do runtime sob uma carga simples, mas não prova superioridade universal em aplicações React complexas, banco de dados, imagens, streaming, Server Components ou CDN.

## Alterações implementadas

O servidor não recompila mais o padrão de rota a cada requisição. Os padrões são compilados quando `createAppServer` é chamado e depois reutilizados.

O servidor também não reimporta o bundle de uma rota usando um query string diferente em cada chamada. Cada bundle é carregado uma vez e mantido em um cache local do processo, permitindo que o cache nativo de módulos do Node.js seja aproveitado. O fluxo de desenvolvimento continua compatível com HMR porque a CLI recria o servidor após cada rebuild.

A cópia de `process.env` foi retirada do caminho de cada requisição. O ambiente combinado com `framework.config.ts` é calculado uma vez por servidor. Os cabeçalhos de segurança também são combinados uma vez e aplicados diretamente em cada resposta.

O compilador agora constrói os bundles das rotas em paralelo. A descoberta de arquivos é ordenada para manter manifests determinísticos e facilitar cache de build.

O logging de conclusão por requisição é desativado por padrão quando `NODE_ENV=production`, reduzindo I/O de console. Em desenvolvimento, o comportamento detalhado permanece ativo. A opção pode ser definida explicitamente com `observability.requestLogging`. O `X-Request-Id` continua ativo por padrão e pode ser desligado com `observability.requestId: false`.

Também foram adicionados testes para comprovar que uma rota é carregada uma única vez e que as opções de observabilidade funcionam.

## Metodologia

O teste foi executado em Linux amd64, com Node.js `v22.13.0`, Jeston compilado a partir da versão otimizada e Next.js `16.3.4` usando o Pages Router. Cada app tem uma página `/` renderizada sob demanda e uma rota `/api/health`. Os dois servidores usaram produção, loopback, 25 workers concorrentes, 100 requisições de aquecimento e uma janela de 10 segundos por alvo.

Para a medição principal do Jeston, `framework.config.ts` definiu `requestId: false` e `requestLogging: false`. Isso evita comparar o I/O de logs do Jeston com um servidor Next.js que não registra cada requisição. A mesma configuração fica disponível para consumidores que desejam throughput máximo.

## Rodada principal de 10 segundos

| Rota | Framework | RPS | P50 | P95 | Máximo | Erros |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `/` | Jeston 0.2.0 | **5.250,28** | **3,912 ms** | **8,932 ms** | 29,094 ms | 0 |
| `/` | Next.js Pages Router | 801,17 | 29,399 ms | 45,967 ms | 220,906 ms | 0 |
| `/api/health` | Jeston 0.2.0 | **5.224,60** | **4,028 ms** | **8,530 ms** | 26,363 ms | 0 |
| `/api/health` | Next.js Pages Router | 2.078,33 | 10,866 ms | 20,701 ms | 48,529 ms | 0 |

Comparado ao resultado anterior do Jeston, o throughput de SSR passou de 1.815,40 para 5.250,28 RPS, um aumento aproximado de **189%**. O p50 caiu de 13,179 ms para 3,912 ms. Na API JSON, o throughput passou de 1.739,92 para 5.224,60 RPS, um aumento aproximado de **200%**.

## Repetições de estabilidade

Foram executadas três rodadas adicionais de três segundos com a mesma concorrência. O Jeston não apresentou erros em nenhuma rodada.

| Rodada | SSR Jeston | SSR Next.js | API Jeston | API Next.js |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4.262,81 RPS | 890,45 RPS | 4.259,51 RPS | 2.164,69 RPS |
| 2 | 4.223,00 RPS | 932,19 RPS | 4.049,41 RPS | 2.174,78 RPS |
| 3 | 4.022,57 RPS | 1.006,53 RPS | 4.357,65 RPS | 2.193,78 RPS |

A média das repetições foi de aproximadamente **4.169 RPS para SSR do Jeston**, contra **943 RPS do Next.js**, e **4.222 RPS para a API do Jeston**, contra **2.178 RPS do Next.js**.

## Build

O build limpo do app mínimo Jeston terminou em aproximadamente **0,32 s**. O build equivalente do Next.js Pages Router continua na ordem de segundos, pois inclui compilação, análise e geração do runtime Next. O tamanho do artefato do Next também inclui runtime, chunks e metadados que não aparecem no bundle mínimo do Jeston.

## Limites da conclusão

Esta medição não inclui React Client Components, Server Components, streaming, hidratação, banco de dados, autenticação, uploads, otimização de imagens, CDN, TLS, proxy reverso ou cache distribuído. O Next.js oferece uma superfície maior e mais integrada para aplicações React; o Jeston oferece uma superfície menor e mais explícita.

A afirmação tecnicamente defensável é: **Jeston 0.2.0 reduziu substancialmente seu overhead de runtime e superou o app mínimo Next.js Pages Router neste cenário SSR e API local, mantendo os recursos do framework.** Uma decisão de produção ainda deve usar a mesma aplicação completa nos dois frameworks.

## Reprodução

```bash
cd /home/ubuntu/benchmark-suite
node http-bench.mjs / 10000 25
node http-bench.mjs /api/health 10000 25
```

O benchmark original e os novos resultados ficam nos arquivos `http-root-pages.jsonl`, `http-api-pages.jsonl`, `http-root-upgraded.jsonl`, `http-api-upgraded.jsonl` e `repeated-upgraded.jsonl` do diretório de comparação.

## Referências

[1]: https://github.com/jeffersoncampos12p-dev/jeston "Jeston by Hedron repository"
[2]: https://nextjs.org/docs/app/guides/self-hosting "How to self-host your Next.js application"
[3]: https://nextjs.org/docs/app/guides/static-exports "How to create a static export of your Next.js application"
