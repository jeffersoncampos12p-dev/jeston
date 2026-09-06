# Benchmark React: Jeston 0.3.0 vs. Next.js 16.3.4

## Resultado executivo

O Jeston 0.3.0 foi atualizado para um modelo React-first. A página comparada agora é uma página React renderizada por SSR, e o runtime também possui `react-dom/server` e streaming React nativo. No mesmo ambiente de benchmark, o Jeston atingiu **4.812,67 RPS em SSR React**, contra **771,46 RPS do Next.js Pages Router**. No endpoint JSON, o Jeston atingiu **4.652,52 RPS**, contra **1.955,57 RPS do Next.js**.

O resultado demonstra baixo overhead do runtime React SSR do Jeston neste cenário mínimo. Ele não prova que o Jeston seja superior ao Next.js em todos os produtos. O Next.js oferece uma plataforma React muito mais ampla, com Server Components, streaming integrado em mais cenários, otimização de imagens, cache e ecossistema maduros.

## O que mudou no Jeston

As páginas agora podem retornar qualquer `ReactNode`, além de continuar aceitando HTML string. O servidor usa `react-dom/server` para transformar a árvore React em HTML SSR. O build de TSX usa o runtime automático do React no esbuild.

O cliente ganhou `hydrate` e `mount` em `@hedronjs/jeston/client`. A CLI agora cria projetos com React, ReactDOM, tipos React, uma página TSX, um componente `App` compartilhado entre servidor e cliente e hidratação no elemento `#root`.

O runtime também aceita `ResponseLike.react` e usa `renderToPipeableStream` para streaming SSR. Isso permite iniciar a resposta antes de toda a árvore React terminar, uma capacidade importante para telas pesadas e aplicações que precisam reduzir o tempo até o primeiro byte.

## Metodologia

O teste foi executado em Linux amd64 com Node.js `v22.13.0`, Jeston compilado do código 0.3.0 e Next.js `16.3.4`. Ambos os apps possuem uma rota `/` dinâmica e uma rota `/api/health`. A rota Jeston retorna elementos React reais usando `react` e é renderizada pelo runtime Jeston. A rota Next usa o Pages Router e `getServerSideProps`.

O cliente executou 25 workers concorrentes, 100 requisições de aquecimento e uma janela de 10 segundos por alvo em loopback sem TLS, banco, proxy ou compressão. O Jeston usou `requestLogging: false` e `requestId: false` para não comparar I/O de console e geração de UUID contra um servidor Next que não registra cada requisição.

## Resultados

| Rota | Framework | Requisições | RPS | P50 | P95 | Máximo | Erros |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | Jeston 0.3.0 React SSR | 48.136 | **4.812,67** | **4,218 ms** | **9,761 ms** | 33,956 ms | 0 |
| `/` | Next.js Pages Router | 7.731 | 771,46 | 30,806 ms | 46,314 ms | 261,320 ms | 0 |
| `/api/health` | Jeston 0.3.0 | 46.535 | **4.652,52** | **4,341 ms** | **10,039 ms** | 25,928 ms | 0 |
| `/api/health` | Next.js Pages Router | 19.576 | 1.955,57 | 11,399 ms | 21,832 ms | 89,373 ms | 0 |

Neste teste, o Jeston teve aproximadamente **6,24 vezes o throughput do Next.js em SSR React** e **2,38 vezes o throughput na API JSON**. A conclusão é específica para a aplicação mínima, a configuração e a máquina descritas.

## Validação funcional

A suíte do Jeston passou com **10 testes**, incluindo SSR React dinâmico, SSG React, API JSON, streaming React, middleware, cache, Edge handler, configuração e logger. Um projeto novo gerado pela CLI foi instalado com o pacote local, passou no typecheck, compilou e respondeu HTML SSR com `#root`, bundle cliente e API health.

## Limitações

O benchmark não mede Server Components, componentes client complexos, hidratação pesada, streaming com Suspense, banco de dados, autenticação, uploads, imagens, CDN, TLS, cache distribuído, múltiplas instâncias ou Web Vitals. Uma avaliação de produção deve usar o mesmo SaaS completo nos dois frameworks e repetir os testes em máquinas limpas.

A formulação tecnicamente correta é: **Jeston 0.3.0 oferece uma base React-first funcional, com SSR, SSG, hidratação e streaming, e apresentou menor overhead neste benchmark React mínimo.**

## Referências

[1]: https://github.com/jeffersoncampos12p-dev/jeston "Jeston by Hedron repository"
[2]: https://react.dev/reference/react-dom/server/renderToPipeableStream "React renderToPipeableStream reference"
[3]: https://nextjs.org/docs/pages/building-your-application/rendering/server-side-rendering "Next.js server-side rendering documentation"
