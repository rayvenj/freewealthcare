# 002: Templates and a tax set-aside (2026-10-29)

## What shipped

- **Budget templates.** Start from a ready-made set of categories instead of a
  blank page. Share them as a single file. They add categories only, never
  touching your transactions or money.
- **1099 Contractor Starter**, the first template. Business categories, health
  insurance, an income smoothing buffer, retirement, and a quarterly estimated
  tax category.
- **Tax set-aside.** Any category can suggest setting aside a share of each
  month's income. Record $4,000 from a client and the Budget screen offers
  "Assign $1,000.00" to Quarterly Estimated Taxes. One tap, and it's covered.
- **Fixes from review.** Automated code review of v0.1 found 12 real issues,
  all fixed: failed saves that still said "done," backups that could restore
  inconsistent data, a CSV edge case, and an overstated security claim (see
  the correction in build log 001).

## Decisions and why

**Templates can only add.** A file someone hands you should never be able to
move your money. The worst a bad template can do is add categories you then
archive.

**Suggest, don't auto-assign.** Moving money is your decision. The app shows
the math and waits for you.

**Starting balances don't count as income.** That money was already yours and
was presumably already taxed. Only new money in triggers a set-aside.

**25% is a starting point, not advice.** Self-employment tax alone is roughly
15.3% on most of your net earnings, before income tax. Your real rate depends
on your income, deductions and state, so it's one tap to change.

## Next up

Transfers between accounts and credit card handling.
