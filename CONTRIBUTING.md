# Contributing to Jeston

Jeston is an open-source project maintained by Kvant. Contributions should preserve compatibility, security, and clarity of the public API.

## Workflow

1. Open an issue for large changes or security bugs.
2. Create a short-lived branch from `main`.
3. Add tests that reproduce the behavior.
4. Run `npm run typecheck`, `npm test`, and `npm run build`.
5. Update the README, changelog, or documentation when the API changes.
6. Open a pull request describing impact, compatibility, and migration requirements.

## Engineering criteria

The core should remain small, typed, and provider-independent. Provider-specific integrations belong in adapters or separate official packages. Do not introduce breaking changes in a minor release. Incompatible changes require a major version, migration notes, and updated examples.

## Pull requests

Describe the problem, solution, tests, and known risks. Do not include secrets, unnecessary dependencies, or irreproducible benchmark claims.
