# Documentation migration

This directory is the canonical Scalar Docs source for Ryvax. The pages and images were migrated from `path/to/docs`, preserving the original MDX content and navigation topics. The legacy Mintlify source remains in the repository for review until the external Scalar project is connected and published.

## Scalar publication prerequisites

Configure the GitHub `production` environment with the `SCALAR_API_KEY` secret. Set the optional `SCALAR_PROJECT_SLUG` repository variable when the Scalar project slug is not `ryvax`. The workflow authenticates with `scalar auth login` and publishes with `scalar project publish --slug`.

## npm publication prerequisites

Configure npm trusted publishing for the GitHub repository and workflow, or add an `NPM_TOKEN` secret to the GitHub `production` environment. The package is scoped as `@kvantjs/ryvax.js` and must be publishable by the npm account represented by that credential.
