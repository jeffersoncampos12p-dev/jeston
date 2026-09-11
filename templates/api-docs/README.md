# Ryvax API Docs

Template open source para criar documentação profissional de APIs usando exclusivamente **Ryvax.js**. O starter entrega uma referência REST moderna, navegação por grupos de endpoints, busca, exemplos de código, schemas visuais, autenticação documentada e um playground frontend que sinaliza quando uma chave real é necessária.

## Stack

Este projeto usa Ryvax.js para roteamento, renderização SSR, exportação estática e configuração de deployment. Não usa Next.js, Astro, Docusaurus ou outro framework de aplicação.

## Desenvolvimento

```bash
npm install
cp .env.example .env
npm run dev
```

Abra `http://localhost:3000`. A página inicial contém a documentação completa de exemplo da Acme API.

## Recursos da interface

A navegação lateral separa Getting Started, Authentication, Errors, Pagination, Projects e Customers. A área de referência permite selecionar cada endpoint, visualizar método HTTP, parâmetros, autenticação, exemplo cURL e resposta JSON. O campo de busca filtra endpoints em tempo real. Os botões Copy usam a Clipboard API quando o navegador permite.

O playground é deliberadamente frontend-only. Ele não executa requisições reais nem expõe secrets. Para conectar uma API real, substitua o comportamento do botão Try it por uma rota server-side Ryvax e mantenha as credenciais fora do bundle público.

## Build e exportação

```bash
npm run typecheck
npm run build
npm run export
npm run build:vercel
```

Para publicar em um subdiretório do GitHub Pages:

```bash
PUBLIC_BASE_PATH=/seu-repositorio npm run export -- --out-dir dist
```

## Customização

Edite `pages/index.tsx` para adicionar endpoints, grupos, guias e schemas. Edite `public/styles.css` para alterar o design system. Edite `public/app.js` para conectar busca, playground e exemplos a APIs próprias.

O template foi pensado como uma base de desenvolvimento. Antes de produção, configure autenticação, rate limiting, observabilidade, CORS, validação de payloads e uma camada server-side para tokens.

## Licença

MIT. Construído com [Ryvax.js](https://github.com/kvantjs/ryvax.js).
