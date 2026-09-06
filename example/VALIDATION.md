# Example validation

- `npm run build` in the framework: passed.
- `npm test` in the framework: all tests passed.
- `npm install` in the example: passed with no reported vulnerabilities.
- `npx tsc --noEmit` in the application: passed.
- `npm run build` in the application: passed with five compiled routes.
- HTTP smoke tests: `/`, `/projects/atlas-mobile`, `/api/health`, and `/api/projects` responded correctly.
- Security headers verified: `X-Content-Type-Options`, `X-Frame-Options`, and `Content-Security-Policy` are present.
