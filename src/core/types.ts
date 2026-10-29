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
  /**
   * Suggested share of each month's income to set aside here, in basis points
   * (2500 = 25%). Used for things like quarterly estimated taxes. 0 means the
   * user switched it off, which templates must respect; undefined means never set.
   */
  setAsideRate?: number;
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
  /** Marks an account's starting balance: money you already had, not new income. */
  opening?: true;
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
