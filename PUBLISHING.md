# Publishing Ryvax

Ryvax is published as the public npm package `@kvantjs/ryvax.js`; the CLI command remains `ryvax`. The complete platform integration is released as one coordinated version, with no intermediate npm publication.

## Local release checks

Run the complete gate from a clean checkout:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
npm audit --audit-level=high
```

Inspect the dry-run file list. It should contain the compiled `dist` tree, `bin/ryvax.mjs`, package metadata, `README.md`, and `LICENSE`, and should not contain local `.env` files, tests, source fixtures, or a local tarball.

## Protected release process

1. Review the `1.2.0` section in `CHANGELOG.md` and any migration notes.
2. Confirm that `package.json`, `package-lock.json`, generated metadata, and documentation all use `1.2.0`.
3. Run the local gates and the CI matrix on Node.js 20, 22, and 24.
4. Inspect `npm pack --dry-run` and run the packed-package smoke import.
5. Merge the approved change through the repository's normal review process.
6. Create a release/tag only in the release operation, not during implementation.
7. Dispatch the protected publish workflow using the `production` environment.
8. Verify package metadata and the tarball after publication.

The workflow uses npm Trusted Publishing through GitHub Actions OIDC (`id-token: write`) with Node 24/npm 11.5+ and `npm publish --access public`; npm generates provenance automatically for trusted publishing. No npm token is committed, printed, or required by the workflow. Repository administrators must configure the npm trusted publisher and the GitHub `production` environment before dispatching it.

## Consumers

```bash
npm install @kvantjs/ryvax.js react react-dom
```

Read `CHANGELOG.md` and `API-COMPATIBILITY.md` before upgrading across a minor or major release. For applications with multiple instances, select distributed cache, durable jobs, and centralized observability adapters before scaling out.
