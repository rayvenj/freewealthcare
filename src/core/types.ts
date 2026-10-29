import type { Cents } from "./money";

/** ISO calendar date, "YYYY-MM-DD". */
export type IsoDate = string;
/** Budget month, "YYYY-MM". */
export type Month = string;

export type AccountType = "checking" | "savings" | "cash" | "credit";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  archived: boolean;
}

export interface Category {
  id: string;
  name: string;
  group: string;
  archived: boolean;
}

/**
 * Reserved category for money coming in. Income lands in "Ready to Assign"
 * instead of a spending category, which is what makes the budget zero-based.
 */
export const INCOME = "income";

export interface Transaction {
  id: string;
  accountId: string;
  date: IsoDate;
  payee: string;
  memo: string;
  /** Positive = money in, negative = money out. */
  amount: Cents;
  /** A category id, INCOME, or null when not yet categorized. */
  categoryId: string | null;
  /** Stable fingerprint for imported rows, so re-importing a file is a no-op. */
  importKey?: string;
}

/** Money given a job: `amount` assigned to `categoryId` in `month`. */
export interface Assignment {
  month: Month;
  categoryId: string;
  amount: Cents;
}

export interface Budget {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  assignments: Assignment[];
}
