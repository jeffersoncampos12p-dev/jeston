# Pulseboard

Aplicação web de demonstração construída com **Jeston**. O Pulseboard é um dashboard operacional para times de produto, com foco em clareza de execução, progresso de projetos e atividade recente.

## O que foi exercitado

- **Roteamento baseado em arquivos:** `pages/index.ts`, `pages/projects/[id].ts` e `pages/api/*`.
- **SSR com cache:** a página inicial exporta `getServerSideProps` e `revalidate = 30`.
- **Rota dinâmica:** `/projects/atlas-mobile` resolve o parâmetro `[id]` no servidor.
- **API routes:** `/api/health` e `/api/projects` respondem JSON.
- **HMR:** `src/client.ts` instala o cliente HMR do framework.
- **Segurança:** `framework.config.ts` desliga a assinatura do servidor, configura cache e complementa a CSP.
- **Arquivos públicos:** `public/styles.css` é servido diretamente pelo runtime.

## Executar

A aplicação usa o framework local no diretório pai:

```bash
npm install
npm run dev
```

Para produção:

```bash
npm run build
npm run start -- --port 4173
```

## Publicar na Netlify

O repositório inclui `netlify.toml` e uma cópia versionada do framework em `framework/`. Isso evita que o build dependa de um pacote publicado ou de um diretório pai que não existe no checkout da Netlify. A configuração usa `npm run export` e publica `dist/`, incluindo a página inicial e os três detalhes de projeto como HTML estático.

Na Netlify, mantenha o **Base directory** vazio, use `npm run export` como **Build command** e `dist` como **Publish directory**. O `npm ci` instala `jeston` a partir de `file:./framework`, e o binário fica disponível em `node_modules/.bin/jeston`.

Esse modo é estático: as páginas e APIs são pré-geradas. Para manter SSR e API routes em produção, use `npm run deploy` em uma plataforma com runtime Node e inicie `node dist/server.mjs`.

Rotas principais:

| Rota | Descrição |
| --- | --- |
| `/` | Dashboard Pulseboard renderizado no servidor |
| `/projects/atlas-mobile` | Detalhe de projeto com parâmetro dinâmico |
| `/api/health` | Health check do serviço |
| `/api/projects` | Dados dos projetos em JSON |

O visual usa uma direção editorial clara: fundo marfim, coral como cor de ação, tipografia Manrope com detalhes em DM Mono, cards leves e grid assimétrico para diferenciar métricas, projetos e atividade.
