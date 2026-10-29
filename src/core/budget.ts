import { sum, type Cents } from "./money";
import { addMonths, monthOf } from "./dates";
import { INCOME, type Budget, type Month } from "./types";

export interface CategoryMonth {
  categoryId: string;
  /** Unspent money carried in from earlier months (negative if overspent). */
  carryover: Cents;
  assigned: Cents;
  /** Net spending in the month; negative means money went out. */
  activity: Cents;
  /** carryover + assigned + activity. Negative means overspent. */
  available: Cents;
}

export interface MonthSummary {
  month: Month;
  /** Money received but not yet given a job, as of the end of this month. */
  readyToAssign: Cents;
  income: Cents;
  assigned: Cents;
  activity: Cents;
  categories: CategoryMonth[];
  /** Spending not yet assigned to any category this month. */
  uncategorized: Cents;
}

/**
 * Zero-based budget for one month.
 *
 * Rules, kept deliberately simple so a user can verify them with a pencil:
 *  - Income (category INCOME) increases Ready to Assign in the month received.
 *  - Assigning money moves it from Ready to Assign into a category.
 *  - A category's available balance carries forward month to month, including
 *    when it is negative. Overspending is not silently forgiven.
 *  - Ready to Assign is cumulative: total income to date minus total assigned
 *    to date. Future-month assignments count against it, so you cannot assign
 *    the same dollar twice.
 */
export function summarizeMonth(budget: Budget, month: Month): MonthSummary {
  const categoryIds = budget.categories.map((c) => c.id);
  const activityBy = new Map<string, Cents>();
  const assignedBy = new Map<string, Cents>();
  let incomeToDate = 0;
  let incomeThisMonth = 0;
  let uncategorized = 0;

  for (const t of budget.transactions) {
    const tm = monthOf(t.date);
    if (t.categoryId === INCOME) {
      if (tm <= month) incomeToDate += t.amount;
      if (tm === month) incomeThisMonth += t.amount;
      continue;
    }
    if (t.categoryId === null) {
      if (tm === month) uncategorized += t.amount;
      continue;
    }
    if (tm > month) continue;
    const key = `${t.categoryId}|${tm}`;
    activityBy.set(key, (activityBy.get(key) ?? 0) + t.amount);
  }

  let assignedEver = 0;
  for (const a of budget.assignments) {
    assignedEver += a.amount;
    if (a.month > month) continue;
    const key = `${a.categoryId}|${a.month}`;
    assignedBy.set(key, (assignedBy.get(key) ?? 0) + a.amount);
  }

  // Earliest month with any data bounds the carryover walk.
  const months = [
    ...budget.transactions.map((t) => monthOf(t.date)),
    ...budget.assignments.map((a) => a.month),
  ].filter((m) => m <= month);
  const start = months.length ? months.reduce((a, b) => (a < b ? a : b)) : month;

  const categories: CategoryMonth[] = categoryIds.map((id) => {
    let balance = 0;
    let row: CategoryMonth = { categoryId: id, carryover: 0, assigned: 0, activity: 0, available: 0 };
    for (let m = start; m <= month; m = addMonths(m, 1)) {
      const assigned = assignedBy.get(`${id}|${m}`) ?? 0;
      const activity = activityBy.get(`${id}|${m}`) ?? 0;
      row = { categoryId: id, carryover: balance, assigned, activity, available: balance + assigned + activity };
      balance = row.available;
    }
    return row;
  });

  // Overspending in a category is covered by the budget as a whole, so uncategorized
  // outflows (money spent without a job) also reduce what is ready to assign.
  const uncategorizedToDate = sum(
    budget.transactions
      .filter((t) => t.categoryId === null && monthOf(t.date) <= month)
      .map((t) => t.amount),
  );

  return {
    month,
    readyToAssign: incomeToDate - assignedEver + uncategorizedToDate,
    income: incomeThisMonth,
    assigned: sum(categories.map((c) => c.assigned)),
    activity: sum(categories.map((c) => c.activity)),
    categories,
    uncategorized,
  };
}

export function accountBalance(budget: Budget, accountId: string): Cents {
  return sum(budget.transactions.filter((t) => t.accountId === accountId).map((t) => t.amount));
}

export function netWorth(budget: Budget): Cents {
  return sum(budget.transactions.map((t) => t.amount));
}
