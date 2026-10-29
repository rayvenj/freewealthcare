import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Account, Assignment, Budget, Category, Transaction } from "../core/types";
import { newId } from "../core/id";

// Everything lives in this browser's IndexedDB. There is no server, no account,
// and no sync: the only way data leaves the device is an export the user makes.

interface FwcSchema extends DBSchema {
  accounts: { key: string; value: Account };
  categories: { key: string; value: Category };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { byImportKey: string };
  };
  assignments: { key: [string, string]; value: Assignment };
}

export type Db = IDBPDatabase<FwcSchema>;

export const DB_NAME = "freewealthcare";

export function openBudgetDb(name = DB_NAME): Promise<Db> {
  return openDB<FwcSchema>(name, 1, {
    upgrade(db) {
      db.createObjectStore("accounts", { keyPath: "id" });
      db.createObjectStore("categories", { keyPath: "id" });
      const tx = db.createObjectStore("transactions", { keyPath: "id" });
      tx.createIndex("byImportKey", "importKey", { unique: true });
      db.createObjectStore("assignments", { keyPath: ["month", "categoryId"] });
    },
  });
}

/**
 * Runs `work` inside `tx` and waits for the commit. If any step fails, the
 * transaction aborts and its `done` promise rejects too; that second rejection
 * is expected, so it is observed here instead of surfacing as unhandled.
 */
async function inTx<T>(tx: { done: Promise<void> }, work: () => Promise<T>): Promise<T> {
  try {
    const result = await work();
    await tx.done;
    return result;
  } catch (e) {
    tx.done.catch(() => {});
    throw e;
  }
}

export async function loadBudget(db: Db): Promise<Budget> {
  const [accounts, categories, transactions, assignments] = await Promise.all([
    db.getAll("accounts"),
    db.getAll("categories"),
    db.getAll("transactions"),
    db.getAll("assignments"),
  ]);
  return { accounts, categories, transactions, assignments };
}

export const DEFAULT_CATEGORIES: [group: string, names: string[]][] = [
  ["Bills", ["Rent / Mortgage", "Utilities", "Phone & Internet", "Insurance"]],
  ["Everyday", ["Groceries", "Transportation", "Dining Out", "Household"]],
  ["Goals", ["Emergency Fund", "Debt Payoff", "Savings"]],
  ["Fun", ["Entertainment", "Gifts"]],
];

/**
 * Seeds starter categories the first time the app opens. Idempotent, including
 * when two calls race (React StrictMode runs effects twice): the emptiness check
 * runs inside the same read-write transaction as the inserts.
 */
export async function seedIfEmpty(db: Db): Promise<void> {
  const tx = db.transaction("categories", "readwrite");
  await inTx(tx, async () => {
    if ((await tx.store.count()) > 0) return;
    for (const [group, names] of DEFAULT_CATEGORIES) {
      for (const name of names) await tx.store.put({ id: newId(), name, group, archived: false });
    }
  });
}

export const putAccount = (db: Db, a: Account) => db.put("accounts", a);

/** Creates an account and its optional starting-balance transaction together, or neither. */
export async function createAccount(db: Db, account: Account, opening?: Transaction): Promise<void> {
  const tx = db.transaction(["accounts", "transactions"], "readwrite");
  await inTx(tx, async () => {
    await tx.objectStore("accounts").put(account);
    if (opening) await tx.objectStore("transactions").put(opening);
  });
}
export const putCategory = (db: Db, c: Category) => db.put("categories", c);

/** Writes several categories in one transaction (used by templates): all land or none do. */
export async function putCategories(db: Db, categories: Category[]): Promise<void> {
  const tx = db.transaction("categories", "readwrite");
  await inTx(tx, async () => {
    for (const c of categories) await tx.store.put(c);
  });
}
export const putTransaction = (db: Db, t: Transaction) => db.put("transactions", t);
export const deleteTransaction = (db: Db, id: string) => db.delete("transactions", id);

/** Sets (not adds to) the amount assigned to a category for a month. */
export async function setAssignment(db: Db, a: Assignment): Promise<void> {
  if (a.amount === 0) await db.delete("assignments", [a.month, a.categoryId]);
  else await db.put("assignments", a);
}

/** Adds imported transactions, skipping any whose importKey is already stored. */
export async function addImported(db: Db, rows: Transaction[]): Promise<{ added: number; skipped: number }> {
  const tx = db.transaction("transactions", "readwrite");
  const index = tx.store.index("byImportKey");
  return inTx(tx, async () => {
    let added = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.importKey && (await index.getKey(row.importKey))) {
        skipped++;
        continue;
      }
      await tx.store.put(row);
      added++;
    }
    return { added, skipped };
  });
}

/** Replaces everything in one transaction: a restore either fully lands or not at all. */
export async function replaceAll(db: Db, budget: Budget): Promise<void> {
  const tx = db.transaction(["accounts", "categories", "transactions", "assignments"], "readwrite");
  await inTx(tx, async () => {
    await Promise.all([
      tx.objectStore("accounts").clear(),
      tx.objectStore("categories").clear(),
      tx.objectStore("transactions").clear(),
      tx.objectStore("assignments").clear(),
    ]);
    for (const a of budget.accounts) await tx.objectStore("accounts").put(a);
    for (const c of budget.categories) await tx.objectStore("categories").put(c);
    for (const t of budget.transactions) await tx.objectStore("transactions").put(t);
    for (const a of budget.assignments) await tx.objectStore("assignments").put(a);
  });
}
