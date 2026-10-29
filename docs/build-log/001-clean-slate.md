# 001: Clean slate (2026-10-29)

## What shipped

The foundation of FreeWealthCare v0.1: a working zero-based budget that runs
entirely in your browser.

- Accounts with starting balances
- Starter categories, plus your own
- Monthly budget: Ready to Assign, Assigned, Activity, Available, with rollover
- Manual transactions and bank CSV import (re-importing the same file adds nothing)
- Backup to a JSON file and restore from it
- 67 automated tests, CI on every push

## Decisions and why

**Local-first, no backend.** The most secure financial database is the one
that does not exist. No server means no breach, no hosting bill that scales
with users, and nothing to trust us with. The tradeoff: no sync between
devices yet. Backup/restore covers that for now.

**No bank connections (yet).** Aggregators require handing over bank
credentials or tokens, a server to hold them, and ongoing per-user fees. CSV
export is available from virtually every bank and keeps the user in control.

**Integer cents everywhere.** `0.1 + 0.2` is not `0.3` in floating point. A
budget that is off by a penny is a budget nobody trusts.

**Overspending carries forward.** Some apps quietly reset negative categories
each month. We keep them visible until you cover them, so the numbers always
reconcile to your actual cash.

**Strict CSP with `connect-src 'none'`.** Even if a dependency were
compromised, the page has no permission to send data anywhere.

## Next up

Transfers and credit cards. Today a credit card payment from checking looks
like spending, which is wrong. Fixing that is the top item for v0.2.
