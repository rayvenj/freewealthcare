import { INCOME, type Transaction } from "./types";

/**
 * Brings records written by older versions up to the current shape. Pure, and
 * safe to run any number of times.
 *
 * v0.1 saved an account's starting balance as an ordinary transaction with the
 * payee "Starting balance" and no marker. Later versions flag it `opening` so
 * it isn't mistaken for new income (for example by the tax set-aside). Only
 * rows the app itself would have created qualify: never imported rows.
 *
 * v0.1 also left a negative starting balance (debt) uncategorized. From v0.2
 * every starting balance uses INCOME, so starting debt reduces Ready to Assign
 * directly instead of nagging as "uncategorized". Ready to Assign is the same
 * either way.
 */
export function migrateTransaction(t: Transaction): Transaction {
  let next = t;
  if (!next.opening && next.importKey === undefined && next.payee === "Starting balance" && next.memo === "") {
    next = { ...next, opening: true };
  }
  if (next.opening && next.categoryId === null) next = { ...next, categoryId: INCOME };
  return next;
}
