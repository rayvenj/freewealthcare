# FreeWealthCare

A private, local-first budgeting app for first-generation wealth builders,
built in public.

**Your money data never leaves your device.** No account, no server, no bank
login, no tracking. Open it, budget, close it.

## Principles

| Principle | What it means in practice |
| --- | --- |
| **Secure** | No backend to breach. The app makes no network requests, and a strict Content Security Policy blocks the usual ways code sends data out (fetch, XHR, WebSockets, beacons, form posts). It is defense in depth, not a guarantee: see [SECURITY.md](SECURITY.md). Every imported file is treated as hostile input. |
| **Useful** | Zero-based budgeting: every dollar gets a job. Manual entry plus bank CSV import with duplicate protection. Start from a [template](docs/templates.md), like the 1099 Contractor Starter with a built-in tax set-aside. |
| **Simple** | Four screens: Budget, Transactions, Accounts, Your data. Rules you can check with a pencil. |
| **Powerful** | Exact integer-cent math, month-to-month rollover, full backup/restore. The engine is pure and tested, so new features build on solid ground. |

## How the budget works

1. **Money in** (income, or a positive starting balance) lands in **Ready to Assign**.
2. **Assign** that money to categories for the month. Ready to Assign goes down.
3. **Spend** from categories. A category's **Available** goes down.
4. Whatever is left in a category **rolls into next month**. Overspending rolls too: it is never silently forgiven.
5. The books always balance: `Ready to Assign + sum of every category's Available = total cash across accounts`. There is a test that enforces this.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build into `dist/` |
| `npm run preview` | Serve the production build (with CSP) locally |
| `npm test` | Unit, storage and UI tests (Vitest) |
| `npm run lint` | ESLint (strict TypeScript rules, raw HTML banned) |
| `npm run check` | Everything CI runs |

## Project layout

```
src/
  core/      Pure budgeting logic: money, dates, budget engine, CSV import, backup and template validation
  templates/ Built-in budget templates (JSON)
  storage/   IndexedDB persistence (on-device only)
  ui/        React screens
docs/        Roadmap and the public build log
```

`core/` has no React and no browser storage. That is deliberate: the rules of
your money live in plain functions that are easy to read, test and audit.

## Build log

We are building this in public. Long-form write-ups, plus personal finance and
tax education that pairs with the app, are published at
[Universal WealthCare](https://universalwealthcare.substack.com/). Progress, decisions and tradeoffs are written
up in [`docs/build-log/`](docs/build-log/). The plan is in
[`docs/ROADMAP.md`](docs/ROADMAP.md).

## Security

See [SECURITY.md](SECURITY.md) for the threat model and how to report a
vulnerability.

## Disclaimer

FreeWealthCare is an educational budgeting tool. It is not financial, tax or
investment advice, and using it does not create a client relationship.

## License

[MIT](LICENSE). Built by [Rayven J. Moore, CPA](https://www.rayvenjmoore.com/).
