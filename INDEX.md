# Repository index

Private, local-first budgeting app built with React, TypeScript and Vite. Money data stays on the device; this index is for the code repository, not a search-engine sitemap.

## Start here
- [README](README.md): product principles, workflow and commands.
- [Security model](SECURITY.md) and [contributing](CONTRIBUTING.md).
- [Roadmap](docs/ROADMAP.md), [template guide](docs/templates.md), [public build log](docs/build-log/).
- [Deployment and safe rollback](docs/deploy.md).

## Code map
- [Pure budget engine](src/core/): integer-cent accounting, transfers, import and backup validation; colocated tests.
- [Local storage](src/storage/): IndexedDB persistence and tests.
- [Budget templates](src/templates/): checked-in starter budgets.
- [Interface](src/ui/): Budget, Transactions, Accounts and Templates & data views.
- [Entry point](src/main.tsx), [HTML metadata](index.html), [build and CSP configuration](vite.config.ts).
- [CI](.github/workflows/ci.yml): lint, typecheck, tests, build, header checks and dependency audit.

## Development checks
Use Node 22 as documented. After installing the locked dependencies, run `npm run check`; it runs lint, typecheck, tests and the production build. `npm run preview` serves the built app locally.

## SEO and next improvements
The repository HTML has a title and description, but no canonical/social card or sitemap. First confirm the preferred production origin, then add these without adding trackers or weakening the no-network CSP. A static public product introduction would help non-JavaScript readers without exposing budget data. Preserve preview noindex headers and the storage-version rollback rules.

Reviewed from the default branch on 2026-11-09. This index records source structure, not a fresh test or deployment certification.
