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

/**
 * Reserved category for money moving between your own accounts, including
 * paying a credit card. A transfer is never income or spending, so it never
 * touches the budget: only the two account balances change.
 */
export const TRANSFER = "transfer";

export interface Transaction {
  id: string;
  accountId: string;
  date: IsoDate;
  payee: string;
  memo: string;
  /** Positive = money in, negative = money out. */
  amount: Cents;
  /** A category id, INCOME, TRANSFER, or null when not yet categorized. */
  categoryId: string | null;
  /** Stable fingerprint for imported rows, so re-importing a file is a no-op. */
  importKey?: string;
  /** Marks an account's starting balance: money you already had, not new income. */
  opening?: true;
  /** For a transfer leg: the id of the matching leg in the other account. */
  transferId?: string;
  /**
   * Set on a transfer leg that exists only because of a transfer action (both
   * legs of a transfer entered as one, or the partner the app created when
   * linking). Removing the transfer removes it. Never set on a row you entered
   * or imported on its own, which the app will not delete for you.
   */
  generated?: true;
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
