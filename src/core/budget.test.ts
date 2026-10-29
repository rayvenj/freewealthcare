import { accountBalance, netWorth, summarizeMonth } from "./budget";
import { INCOME, type Budget, type Transaction } from "./types";

let n = 0;
const txn = (date: string, amount: number, categoryId: string | null, accountId = "chk"): Transaction => ({
  id: `t${++n}`,
  accountId,
  date,
  payee: "x",
  memo: "",
  amount,
  categoryId,
});

const base = (): Budget => ({
  accounts: [{ id: "chk", name: "Checking", type: "checking", archived: false }],
  categories: [
    { id: "groc", name: "Groceries", group: "Everyday", archived: false },
    { id: "rent", name: "Rent", group: "Bills", archived: false },
  ],
  transactions: [],
  assignments: [],
});

const cat = (s: ReturnType<typeof summarizeMonth>, id: string) =>
  s.categories.find((c) => c.categoryId === id)!;

describe("summarizeMonth", () => {
  it("puts income in ready to assign", () => {
    const b = base();
    b.transactions.push(txn("2026-10-01", 300000, INCOME));
    const s = summarizeMonth(b, "2026-10");
    expect(s.readyToAssign).toBe(300000);
    expect(s.income).toBe(300000);
  });

  it("assigning moves money out of ready to assign", () => {
    const b = base();
    b.transactions.push(txn("2026-10-01", 300000, INCOME));
    b.assignments.push({ month: "2026-10", categoryId: "rent", amount: 150000 });
    const s = summarizeMonth(b, "2026-10");
    expect(s.readyToAssign).toBe(150000);
    expect(cat(s, "rent").available).toBe(150000);
  });

  it("spending reduces the category, not ready to assign", () => {
    const b = base();
    b.transactions.push(txn("2026-10-01", 100000, INCOME), txn("2026-10-05", -12345, "groc"));
    b.assignments.push({ month: "2026-10", categoryId: "groc", amount: 40000 });
    const s = summarizeMonth(b, "2026-10");
    expect(s.readyToAssign).toBe(60000);
    expect(cat(s, "groc")).toMatchObject({ assigned: 40000, activity: -12345, available: 27655 });
  });

  it("carries leftover and overspending forward", () => {
    const b = base();
    b.transactions.push(
      txn("2026-09-01", 100000, INCOME),
      txn("2026-09-10", -10000, "groc"),
      txn("2026-09-12", -5000, "rent"),
    );
    b.assignments.push({ month: "2026-09", categoryId: "groc", amount: 30000 });
    const oct = summarizeMonth(b, "2026-10");
    expect(cat(oct, "groc")).toMatchObject({ carryover: 20000, assigned: 0, activity: 0, available: 20000 });
    expect(cat(oct, "rent")).toMatchObject({ carryover: -5000, available: -5000 });
  });

  it("walks carryover across empty months", () => {
    const b = base();
    b.assignments.push({ month: "2026-01", categoryId: "groc", amount: 5000 });
    expect(cat(summarizeMonth(b, "2026-06"), "groc").available).toBe(5000);
  });

  it("counts future assignments against ready to assign so a dollar can't be assigned twice", () => {
    const b = base();
    b.transactions.push(txn("2026-10-01", 50000, INCOME));
    b.assignments.push({ month: "2026-11", categoryId: "rent", amount: 50000 });
    expect(summarizeMonth(b, "2026-10").readyToAssign).toBe(0);
  });

  it("ignores income from future months", () => {
    const b = base();
    b.transactions.push(txn("2026-11-01", 50000, INCOME));
    expect(summarizeMonth(b, "2026-10").readyToAssign).toBe(0);
  });

  it("reports uncategorized spending and charges it to ready to assign", () => {
    const b = base();
    b.transactions.push(txn("2026-10-01", 50000, INCOME), txn("2026-10-02", -2000, null));
    const s = summarizeMonth(b, "2026-10");
    expect(s.uncategorized).toBe(-2000);
    expect(s.readyToAssign).toBe(48000);
  });

  it("the budget always balances: cash = ready to assign + all category balances", () => {
    const b = base();
    b.transactions.push(
      txn("2026-08-01", 250000, INCOME),
      txn("2026-08-03", -90000, "rent"),
      txn("2026-09-01", 250000, INCOME),
      txn("2026-09-04", -14000, "groc"),
      txn("2026-09-09", -700, null),
      txn("2026-10-01", 250000, INCOME),
    );
    b.assignments.push(
      { month: "2026-08", categoryId: "rent", amount: 100000 },
      { month: "2026-09", categoryId: "groc", amount: 20000 },
      { month: "2026-10", categoryId: "rent", amount: 100000 },
    );
    const s = summarizeMonth(b, "2026-10");
    const categoryTotal = s.categories.reduce((t, c) => t + c.available, 0);
    expect(s.readyToAssign + categoryTotal).toBe(netWorth(b));
  });
});

describe("balances", () => {
  it("sums per account and overall", () => {
    const b = base();
    b.accounts.push({ id: "sav", name: "Savings", type: "savings", archived: false });
    b.transactions.push(txn("2026-10-01", 1000, INCOME), txn("2026-10-01", 500, INCOME, "sav"));
    expect(accountBalance(b, "chk")).toBe(1000);
    expect(accountBalance(b, "sav")).toBe(500);
    expect(netWorth(b)).toBe(1500);
  });
});
