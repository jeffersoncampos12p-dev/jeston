# Publicar o Jeston no npm

O pacote público do framework se chama `@hedronjs/jeston` e é distribuído pela organização HedronJS. O comando da CLI continua sendo `jeston`. O repositório oficial é `https://github.com/jeffersoncampos12p-dev/jeston`.

## Pré-requisitos

Use Node.js 20 ou superior e uma conta no npm. O nome `jeston` foi verificado como disponível no momento da preparação, mas a disponibilidade pode mudar antes da publicação.

## Publicação inicial

Na raiz do repositório:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
npm login
npm whoami
npm publish --access public
```

O script `prepublishOnly` recompila o pacote antes da publicação. O tarball conterá `dist/`, `bin/jeston.mjs`, `README.md`, `LICENSE` e `package.json`; fontes, testes e o exemplo ficam fora do pacote por meio de `.npmignore`.

## Verificação pós-publicação

```bash
npm view @hedronjs/jeston version
npx jeston create demo-app --no-tailwind
cd demo-app
npm install
npm run dev
```

Para publicar uma nova versão:

```bash
npm version patch   # correção compatível
npm version minor   # nova funcionalidade compatível
npm version major   # mudança incompatível
npm publish --access public
git push --follow-tags origin main
```

## Segurança

Nunca coloque token npm no repositório, no README, no `package.json` ou em comandos salvos no histórico. Prefira `npm login` com autenticação web ou um token configurado no ambiente de CI. O workflow do GitHub executa verificação e `npm pack --dry-run`, mas não publica automaticamente.
