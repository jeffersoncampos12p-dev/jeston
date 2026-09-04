# Validação

- `npm run build` no framework: aprovado.
- `npm test` no framework: 8 testes aprovados.
- `npm install` no exemplo: aprovado, zero vulnerabilidades reportadas.
- `npx tsc --noEmit` no app: aprovado.
- `npm run build` no app: aprovado, 5 rotas compiladas.
- Smoke test HTTP: `/`, `/projects/atlas-mobile`, `/api/health` e `/api/projects` responderam corretamente.
- Headers verificados: `X-Content-Type-Options`, `X-Frame-Options` e `Content-Security-Policy` presentes.
