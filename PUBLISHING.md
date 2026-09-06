# Publishing Jeston

Jeston is published as the public npm package `@hedronjs/jeston` by the Hedron organization. The CLI command remains `jeston`.

## Local release checks

```bash
npm ci
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
npm pack --dry-run
```

## Release process

1. Update the changelog and migration documentation.
2. Update the version using semantic versioning.
3. Run all local quality gates.
4. Commit the release and create an annotated tag.
5. Push the branch and tag to GitHub.
6. Run the protected publish workflow.
7. Verify package metadata and the tarball on npm.

The workflow installs dependencies from the lockfile, runs typecheck, tests, build, and publishes with public access. The npm token must remain a GitHub Actions secret and must never be committed or printed.

## Consumers

```bash
npm install @hedronjs/jeston react react-dom
```

Read `CHANGELOG.md` and `API-COMPATIBILITY.md` before upgrading across a minor or major release.
