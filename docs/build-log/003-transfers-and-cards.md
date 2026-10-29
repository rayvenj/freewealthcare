# 003: Transfers and credit cards (2026-10-29)

## What shipped

- **Transfers.** Move money between your own accounts: checking to savings,
  cash to checking. It changes both balances and nothing in your budget,
  because it's still your money.
- **Credit cards that make sense.** Buy groceries on a card and pick
  Groceries: that category pays for it, right then. Paying the card later is a
  transfer, not new spending. That fixes the biggest v0.1 bug, where a card
  payment looked like spending.
- **Starting debt is honest.** Add a card with $850 owed and Ready to Assign
  drops by $850. Debt you already have has to be covered by your budget.
- **"Pay card" shortcut.** Each card with a balance shows what you owe and a
  one-line form to pay it from checking.
- **Imports that link up.** Import your bank statement and your card
  statement, and both show the same $250 payment. Mark the bank row as
  "Transfer to Visa" and the app finds the matching card row (same amount,
  within 5 days) and links them. One payment, no duplicates.

## Decisions and why

**Cards work like cash.** Some apps track a separate "card payment" bucket
for every card. It's precise but hard to learn. We start simpler: categorize
card purchases like cash, and the budget already accounts for them. The math
still ties out to the penny, and a test proves it after every kind of
transaction.

**The app never deletes what you typed or imported.** If you unlink a
transfer whose other side came from your bank file, that row stays and goes
back to "uncategorized." Only the side the app created for you gets removed.

**Old data upgrades itself.** Budgets created before this version are
migrated automatically the first time you open the app, and the same
migration runs on restored backups.

## Also fixed

- Two review findings on the templates release: old starting balances could
  count as income for the tax set-aside, and turning the set-aside off didn't
  stick when re-applying a template.
- On phones, the Transactions page was wider than the screen.

## Next up

Editing a transaction in place, search, renaming categories, and putting
FreeWealthCare on the web with proper security headers.
