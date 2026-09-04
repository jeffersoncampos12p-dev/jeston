# Jeston by Hedron

Pacote npm: `@hedronjs/jeston` · CLI: `jeston`

**Jeston** é um framework full-stack criado pela **Hedron**, em Node.js e TypeScript, para construir SaaS, backends para produtos web e ferramentas internas com uma superfície pequena e extensível. O projeto implementa roteamento baseado em arquivos, SSR, SSG, API routes, compilação esbuild, HMR por SSE, cache HTTP, cabeçalhos de segurança, middleware, validação por Zod, adaptadores de dados e uma CLI publicável no NPM.

> O objetivo deste repositório é fornecer uma base funcional e legível para evolução de produto. O runtime é deliberadamente explícito: cada camada pode ser substituída sem depender de um servidor proprietário.

## Arquitetura

O framework organiza o fluxo de uma aplicação em cinco camadas.

| Camada | Responsabilidade | Implementação |
| --- | --- | --- |
| Descoberta | Converte arquivos em rotas e parâmetros | `src/router.ts` |
| Compilação | Gera bundles ESM para servidor e navegador | `src/compiler.ts` + esbuild |
| Runtime | Executa SSR, SSG, API routes e arquivos estáticos | `src/server.ts` |
| Plataforma | Auth, schemas, cache, segurança e dados | `src/middleware.ts`, `src/cache.ts`, `src/data.ts`, `src/security.ts` |
| Experiência | Cria, desenvolve, compila e inicia projetos | `src/cli/index.ts` |

O pipeline de desenvolvimento é:

```text
pages/**/*.{ts,tsx,js,jsx}
          │
          ▼
   descoberta de rotas
          │
          ▼
  manifest + bundles ESM
          │
          ├── servidor Node: SSR / API
          ├── arquivos estáticos: public/
          └── cliente: src/client.ts + HMR SSE
```

## Instalação e uso

Em um projeto consumidor, a experiência pretendida é:

```bash
npx jeston create billing-app
cd billing-app
npm install
npm run dev
```

A CLI cria a estrutura mínima, inclui TypeScript, uma rota de página, uma API de health check, um cliente HMR e configuração opcional de Tailwind CSS.

Os comandos disponíveis são:

| Comando | Resultado |
| --- | --- |
| `jeston create <nome>` | Gera uma aplicação nova |
| `jeston create <nome> --no-tailwind` | Gera a aplicação sem os arquivos de Tailwind |
| `jeston dev --port 3000` | Compila, inicia o servidor e observa alterações |
| `jeston build` | Compila bundles de produção e páginas SSG |
| `jeston export --out-dir dist` | Gera um site estático publicável em qualquer CDN |
| `jeston deploy --out-dir dist` | Gera um pacote Node portátil com `server.mjs` |
| `jeston start --port 3000` | Inicia o manifest gerado em `.meu/` |

## Roteamento baseado em arquivos

A pasta `pages/` é a fonte de verdade do roteamento.

| Arquivo | URL | Tipo |
| --- | --- | --- |
| `pages/index.ts` | `/` | Página |
| `pages/about.tsx` | `/about` | Página |
| `pages/users/[id].ts` | `/users/:id` | Página dinâmica |
| `pages/docs/[...slug].ts` | `/docs/*slug` | Catch-all |
| `pages/api/health.ts` | `/api/health` | API route |

Uma página exporta uma função `default` que retorna HTML. Ela pode exportar `getServerSideProps`, `getStaticProps`, `revalidate` e `headers`.

```ts
export const revalidate = 30;

export async function getServerSideProps(context) {
  return { id: context.params.id, query: Object.fromEntries(context.query) };
}

export default async function page(props) {
  return `<main><h1>Usuário ${props.id}</h1></main>`;
}
```

O runtime aceita funções assíncronas. O contexto inclui URL, query string, parâmetros, headers, body, estado compartilhado por middleware, ambiente e a referência do request/response Node.

## API routes

Uma API pode exportar um handler por método HTTP ou um `default`.

```ts
import { authMiddleware, validateBody, z } from 'jeston';

const input = z.object({ name: z.string().min(2) });

export const middleware = [
  authMiddleware({
    verify: async (token) => token === process.env.API_TOKEN ? { id: 'service' } : null
  }),
  validateBody(input)
];

export async function POST({ body, state }) {
  return { json: { createdBy: state.user, payload: body }, status: 201 };
}
```

A composição global de middleware é configurada ao criar o servidor. Uma API route também pode exportar `middleware`, que é executado depois do middleware global e antes do handler HTTP.

## Dados e integrações

`src/data.ts` fornece três adaptadores com o mesmo contrato `DatabaseAdapter`:

| Adaptador | Uso |
| --- | --- |
| `createMemoryAdapter` | testes e protótipos locais |
| `createPrismaAdapter` | delega para os models do Prisma |
| `createSupabaseAdapter` | delega para o cliente Supabase |

O contrato é intencionalmente pequeno:

```ts
const db = createMemoryAdapter({ users: [] });
const user = await db.create('users', { email: 'ana@example.com' });
const found = await db.findUnique('users', { id: user.id });
```

Um adaptador de produção pode implementar as cinco operações sem alterar páginas ou API routes.

## SSR, SSG e cache

O modo padrão é SSR. Quando uma página exporta `getStaticProps`, o comando `build` gera um arquivo HTML estático para a rota. Quando uma página exporta `revalidate`, o runtime aplica um cache TTL em memória e responde com cabeçalhos de cache HTTP configuráveis.

```ts
export const revalidate = 60;
export const headers = { 'X-Page-Version': 'v1' };

export const getStaticProps = async () => ({ title: 'Dashboard' });

export default (props) => `<h1>${props.title}</h1>`;
```

Configurações de cache e segurança são fornecidas na criação do servidor:

```ts
const app = createAppServer(manifest, {
  rootDir: process.cwd(),
  cache: { enabled: true, defaultTtl: 30, staleWhileRevalidate: 60 },
  securityHeaders: { 'Content-Security-Policy': "default-src 'self'" }
});
```

O runtime envia por padrão `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` e uma CSP conservadora. Aplicações podem substituir ou complementar esses valores.

## Configuração da aplicação

O runtime procura `framework.config.ts`, `framework.config.mts`, `framework.config.js` ou `framework.config.mjs` na raiz. Arquivos TypeScript são compilados pelo próprio esbuild antes de serem carregados; o projeto consumidor não precisa de `tsx` para iniciar em produção. `.env` e `.env.local` também são carregados sem substituir variáveis já definidas pelo processo.

```ts
import type { AppConfig } from 'jeston';

export default {
  poweredBy: false,
  cache: { enabled: true, defaultTtl: 30, staleWhileRevalidate: 60 },
  securityHeaders: { 'Content-Security-Policy': "default-src 'self'" }
} satisfies AppConfig;
```

## Compilação e HMR

O compilador usa esbuild para gerar um bundle ESM por rota. Dependências de pacote permanecem externas ao bundle de servidor para reduzir o tempo de build e permitir que o runtime Node resolva as versões instaladas pela aplicação. O bundle do cliente usa plataforma browser.

No modo `dev`, chokidar observa `pages/` e `src/`. Cada alteração dispara um rebuild, reinicia o servidor de forma segura na mesma porta e envia um evento `reload` pelo endpoint SSE `/_meu/hmr`. O cliente pode ativar o reload com:

```ts
import { installHmr } from 'jeston/client';
installHmr();
```

## Edge runtime

Os contratos de `RequestContext` e `ApiHandler` mantêm a informação de runtime (`node` ou `edge`) explícita. A implementação incluída usa o servidor HTTP nativo do Node, porque isso permite integração direta com filesystem, esbuild e CLI. `createEdgeHandler` fornece o adaptador Fetch para handlers que não dependem das APIs Node. O deploy Edge deve empacotar os bundles ESM da aplicação no provedor e fornecer um loader compatível com o seu sistema de módulos.

## Deploy em plataformas externas

O comando `deploy` transforma uma aplicação em um artefato convencional de Node, sem substituir o runtime do framework. Ele gera `dist/server.mjs`, `dist/.meu/manifest.json`, os bundles das rotas, os arquivos de `public/` e um `package.json` mínimo. O launcher usa `PORT` e `HOST`, escuta em `0.0.0.0` por padrão e localiza os próprios arquivos por caminho absoluto, portanto pode ser iniciado a partir de qualquer diretório.

```bash
npm run deploy
PORT=8080 node dist/server.mjs
```

Em uma plataforma que separa os comandos, use `npm run deploy` como **Build Command** e `node dist/server.mjs` como **Start Command**. O ambiente precisa fornecer Node 20 ou superior e instalar as dependências do projeto antes do build. Isso torna o framework reconhecível por plataformas que aceitam um servidor Node convencional, mesmo que elas não tenham um adaptador específico para o framework.

Quando a plataforma oferece somente hospedagem estática, use `jeston export`. Esse comando copia HTML SSG e arquivos públicos para `dist/`. Apenas páginas com `getStaticProps` são exportadas; API routes, SSR e páginas dinâmicas sem `getStaticPaths` continuam exigindo o pacote Node.

## Tailwind e arquivos públicos

O template da CLI inclui `tailwindcss`, `postcss` e `autoprefixer`. O script `css:build` compila `src/styles.css` para `public/styles.css` antes de `dev` e `build`. Arquivos em `public/` são servidos diretamente pelo runtime com o mesmo caminho a partir da raiz.

## Estrutura gerada

```text
meu-app/
├── pages/
│   ├── index.tsx
│   └── api/health.ts
├── public/styles.css
├── src/client.ts
├── src/env.d.ts
├── framework.config.ts
├── tailwind.config.ts
├── postcss.config.cjs
├── package.json
├── tsconfig.json
└── .env.example
```

## Desenvolvimento deste repositório

```bash
npm install
npm run typecheck
npm test
npm run build
```

Para testar o exemplo incluído:

```bash
cd example
npm install ../
../node_modules/.bin/jeston build
../node_modules/.bin/jeston start
```

O exemplo é intencionalmente independente de React. A função de página pode ser substituída por uma camada de componentes, JSX ou outro renderer sem alterar o roteador.

## Limites deliberados da primeira versão

A primeira versão mantém o escopo de infraestrutura pequeno. O cache é local ao processo, não existe invalidação distribuída, o SSG dinâmico exige uma etapa explícita de geração de paths e o runtime Edge requer um adaptador específico do provedor. Esses limites deixam os contratos claros e evitam acoplar o núcleo a uma plataforma de deploy.

## Referências

[1]: https://nodejs.org/api/http.html "Node.js HTTP API"
[2]: https://esbuild.github.io/api/ "esbuild JavaScript API"
[3]: https://www.typescriptlang.org/docs/ "TypeScript Handbook"
[4]: https://zod.dev/ "Zod Documentation"
[5]: https://tailwindcss.com/docs/installation "Tailwind CSS Installation"
