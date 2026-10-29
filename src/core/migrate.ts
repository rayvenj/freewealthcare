import type { Transaction } from "./types";

/**
 * Brings records written by older versions up to the current shape. Pure, and
 * safe to run any number of times.
 *
 * v0.1 saved an account's starting balance as an ordinary transaction with the
 * payee "Starting balance" and no marker. Later versions flag it `opening` so
 * it isn't mistaken for new income (for example by the tax set-aside). Only
 * rows the app itself would have created qualify: never imported rows.
 */
export function migrateTransaction(t: Transaction): Transaction {
  if (t.opening || t.importKey !== undefined) return t;
  if (t.payee === "Starting balance" && t.memo === "") return { ...t, opening: true };
  return t;
}
