import { TRANSFER, type Budget, type IsoDate, type Transaction } from "./types";
import type { Cents } from "./money";

// A transfer is two linked transactions: money out of one account and the same
// amount into another. Both carry category TRANSFER and point at each other via
// transferId. Because the two legs sum to zero and are never income or
// spending, the budget (Ready to Assign and every category) is unaffected; only
// the account balances move. Paying a credit card from checking is a transfer.
//
// Everything here is pure: functions return the changes to make, and storage
// applies them in one transaction.

export interface Changes {
  put: Transaction[];
  del: string[];
}

const none = (): Changes => ({ put: [], del: [] });

/** How far apart (in days) two legs can be and still match, e.g. a card payment that posts later. */
export const MATCH_WINDOW_DAYS = 5;

function dayNumber(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Records a new transfer of `amount` (positive cents) from one account to another. */
export function newTransfer(
  input: { fromAccountId: string; toAccountId: string; date: IsoDate; amount: Cents; payee: string; memo?: string },
  newId: () => string,
): Changes {
  if (input.fromAccountId === input.toAccountId) throw new Error("Pick two different accounts.");
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new Error("Enter an amount above zero.");
  const outId = newId();
  const inId = newId();
  const leg = (id: string, accountId: string, amount: Cents, transferId: string): Transaction => ({
    id,
    accountId,
    date: input.date,
    payee: input.payee,
    memo: input.memo ?? "",
    amount,
    categoryId: TRANSFER,
    transferId,
    // Entered as one action, so removing the transfer removes both legs.
    generated: true,
  });
  return {
    put: [leg(outId, input.fromAccountId, -input.amount, inId), leg(inId, input.toAccountId, input.amount, outId)],
    del: [],
  };
}

/**
 * Finds the transaction in `accountId` that is the other side of `t`: the
 * opposite amount, not already a transfer, within the match window. Prefers the
 * closest date, then imported rows (they are real bank records).
 */
export function findCounterpart(budget: Budget, t: Transaction, accountId: string): Transaction | undefined {
  const day = dayNumber(t.date);
  return budget.transactions
    .filter(
      (c) =>
        c.id !== t.id &&
        c.accountId === accountId &&
        c.amount === -t.amount &&
        c.transferId === undefined &&
        !c.opening &&
        Math.abs(dayNumber(c.date) - day) <= MATCH_WINDOW_DAYS,
    )
    .sort(
      (a, b) =>
        Math.abs(dayNumber(a.date) - day) - Math.abs(dayNumber(b.date) - day) ||
        Number(b.importKey !== undefined) - Number(a.importKey !== undefined) ||
        a.id.localeCompare(b.id),
    )[0];
}

/**
 * Turns an existing transaction into one leg of a transfer with `accountId`.
 * Links to a matching transaction there if one exists (typical after importing
 * both bank and card statements); otherwise creates the other leg.
 */
export function linkTransfer(budget: Budget, txnId: string, accountId: string, newId: () => string): Changes {
  const t = budget.transactions.find((x) => x.id === txnId);
  if (!t) throw new Error("That transaction no longer exists.");
  if (t.accountId === accountId) throw new Error("A transfer needs two different accounts.");
  if (t.amount === 0) throw new Error("A transfer needs an amount.");

  // Re-pointing an existing transfer: undo the old link first.
  const changes = t.transferId !== undefined ? unlinkTransfer(budget, txnId, null) : none();
  const working = applyChanges(budget, changes);
  const current = working.transactions.find((x) => x.id === txnId)!;

  const match = findCounterpart(working, current, accountId);
  const otherId = match?.id ?? newId();
  const self: Transaction = { ...current, categoryId: TRANSFER, transferId: otherId };
  const other: Transaction = match
    ? { ...match, categoryId: TRANSFER, transferId: self.id }
    : {
        id: otherId,
        accountId,
        date: current.date,
        payee: current.payee,
        memo: "",
        amount: -current.amount,
        categoryId: TRANSFER,
        transferId: self.id,
        generated: true,
      };
  return merge(changes, { put: [self, other], del: [] });
}

/**
 * Stops treating a transaction as a transfer and gives it `categoryId`. The
 * other leg is deleted if the app generated it; if it is a real record (entered
 * or imported), it is kept and left uncategorized so nothing you typed or
 * imported is ever silently lost.
 */
export function unlinkTransfer(budget: Budget, txnId: string, categoryId: string | null): Changes {
  const t = budget.transactions.find((x) => x.id === txnId);
  if (!t) throw new Error("That transaction no longer exists.");
  const self = withoutTransfer(t, categoryId);
  const other = t.transferId ? budget.transactions.find((x) => x.id === t.transferId) : undefined;
  if (!other) return { put: [self], del: [] };
  if (other.generated) return { put: [self], del: [other.id] };
  return { put: [self, withoutTransfer(other, null)], del: [] };
}

/** Deletes a transaction. For a transfer leg, the generated other leg goes too; a real one is kept, uncategorized. */
export function deleteTransactionChanges(budget: Budget, txnId: string): Changes {
  const t = budget.transactions.find((x) => x.id === txnId);
  if (!t) return none();
  const other = t.transferId ? budget.transactions.find((x) => x.id === t.transferId) : undefined;
  if (!other) return { put: [], del: [t.id] };
  if (other.generated) return { put: [], del: [t.id, other.id] };
  return { put: [withoutTransfer(other, null)], del: [t.id] };
}

/** The other leg of a transfer, if `t` is one. */
export function counterpartOf(budget: Budget, t: Transaction): Transaction | undefined {
  return t.transferId ? budget.transactions.find((x) => x.id === t.transferId) : undefined;
}

function withoutTransfer(t: Transaction, categoryId: string | null): Transaction {
  const { transferId: _transferId, generated: _generated, ...rest } = t;
  return { ...rest, categoryId };
}

function merge(a: Changes, b: Changes): Changes {
  const del = new Set([...a.del, ...b.del]);
  const put = new Map<string, Transaction>();
  for (const t of [...a.put, ...b.put]) put.set(t.id, t);
  for (const id of put.keys()) del.delete(id);
  return { put: [...put.values()], del: [...del] };
}

/** Applies changes to an in-memory budget (used to compose steps and in tests). */
export function applyChanges(budget: Budget, changes: Changes): Budget {
  const del = new Set(changes.del);
  const put = new Map(changes.put.map((t) => [t.id, t]));
  const kept = budget.transactions.filter((t) => !del.has(t.id) && !put.has(t.id));
  return { ...budget, transactions: [...kept, ...put.values()] };
}

/**
 * Integrity rule for transfers, shared by backup validation and tests: every
 * leg points at a leg in a different account that points back, with the
 * opposite amount. Returns a description of the first problem, or null.
 */
export function transferProblem(transactions: Transaction[]): string | null {
  const byId = new Map(transactions.map((t) => [t.id, t]));
  for (const t of transactions) {
    const isTransfer = t.categoryId === TRANSFER;
    if (isTransfer !== (t.transferId !== undefined)) return `transaction ${t.id} is half a transfer`;
    if (!isTransfer) continue;
    const other = byId.get(t.transferId!);
    if (!other) return `transfer ${t.id} points to a missing transaction`;
    if (other.transferId !== t.id || other.categoryId !== TRANSFER) return `transfer ${t.id} is not linked both ways`;
    if (other.accountId === t.accountId) return `transfer ${t.id} moves money within one account`;
    if (other.amount !== -t.amount) return `transfer ${t.id} amounts don't match`;
  }
  return null;
}
