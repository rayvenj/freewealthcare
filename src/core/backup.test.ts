import { parseBackup, toBackup } from "./backup";
import type { Budget } from "./types";

const budget: Budget = {
  accounts: [{ id: "a1", name: "Checking", type: "checking", archived: false }],
  categories: [{ id: "c1", name: "Groceries", group: "Everyday", archived: false }],
  transactions: [
    { id: "t1", accountId: "a1", date: "2026-10-01", payee: "Market", memo: "", amount: -1234, categoryId: "c1" },
    { id: "t2", accountId: "a1", date: "2026-10-02", payee: "Pay", memo: "", amount: 5000, categoryId: "income", importKey: "k" },
  ],
  assignments: [{ month: "2026-10", categoryId: "c1", amount: 2000 }],
};

describe("backup", () => {
  it("round-trips", () => {
    const result = parseBackup(toBackup(budget));
    expect(result).toEqual({ ok: true, budget });
  });

  it("rejects non-JSON", () => {
    expect(parseBackup("{nope")).toMatchObject({ ok: false });
  });

  it("rejects other formats and versions", () => {
    expect(parseBackup(JSON.stringify({ format: "other", version: 1, exportedAt: "", data: budget }))).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ format: "freewealthcare-backup", version: 2, exportedAt: "", data: budget }))).toMatchObject({ ok: false });
  });

  it("rejects fractional cents and unknown account types", () => {
    const bad = structuredClone(budget);
    bad.transactions[0]!.amount = 12.5;
    expect(parseBackup(toBackup(bad))).toMatchObject({ ok: false });
    const bad2 = JSON.parse(toBackup(budget));
    bad2.data.accounts[0].type = "crypto";
    expect(parseBackup(JSON.stringify(bad2))).toMatchObject({ ok: false });
  });

  it("rejects transactions pointing to missing accounts", () => {
    const bad = structuredClone(budget);
    bad.transactions[0]!.accountId = "ghost";
    expect(parseBackup(toBackup(bad))).toMatchObject({ ok: false, error: expect.stringMatching(/missing account/) });
  });

  it.each([
    ["impossible date", (b: Budget) => (b.transactions[0]!.date = "2026-02-30"), /calendar date/],
    ["month 13", (b: Budget) => (b.assignments[0]!.month = "2026-13"), /valid month/],
    ["unknown transaction category", (b: Budget) => (b.transactions[0]!.categoryId = "ghost"), /missing category/],
    ["unknown assignment category", (b: Budget) => (b.assignments[0]!.categoryId = "ghost"), /missing category/],
    ["duplicate account id", (b: Budget) => b.accounts.push({ ...b.accounts[0]! }), /duplicate account/],
    ["duplicate category id", (b: Budget) => b.categories.push({ ...b.categories[0]! }), /duplicate category/],
    ["duplicate transaction id", (b: Budget) => b.transactions.push({ ...b.transactions[0]! }), /duplicate transaction/],
    ["duplicate import key", (b: Budget) => (b.transactions[0]!.importKey = "k"), /duplicate import key/],
    ["duplicate assignment", (b: Budget) => b.assignments.push({ ...b.assignments[0]! }), /more than one assignment/],
    ["reserved income id", (b: Budget) => (b.categories[0]!.id = "income"), /reserved/],
  ])("rejects %s", (_name, corrupt, message) => {
    const bad = structuredClone(budget);
    corrupt(bad);
    expect(parseBackup(toBackup(bad))).toMatchObject({ ok: false, error: expect.stringMatching(message) });
  });

  it("keeps the starting-balance marker", () => {
    const b = structuredClone(budget);
    b.transactions[1]!.opening = true;
    const result = parseBackup(toBackup(b));
    expect(result.ok && result.budget.transactions[1]!.opening).toBe(true);
  });

  it("drops unknown fields instead of storing them", () => {
    const raw = JSON.parse(toBackup(budget));
    raw.data.accounts[0].__proto__polluted = "x";
    raw.data.accounts[0].extra = "<script>";
    const result = parseBackup(JSON.stringify(raw));
    expect(result.ok && result.budget.accounts[0]).toEqual(budget.accounts[0]);
  });
});
