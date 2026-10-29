import { accountBalance, netWorth, summarizeMonth } from "./budget";
import {
  applyChanges,
  deleteTransactionChanges,
  findCounterpart,
  linkTransfer,
  newTransfer,
  transferProblem,
  unlinkTransfer,
} from "./transfers";
import { incomeForSetAside } from "./templates";
import { INCOME, TRANSFER, type Budget, type Transaction } from "./types";

let n = 0;
const ids = () => `id-${++n}`;
const txn = (over: Partial<Transaction> & Pick<Transaction, "accountId" | "date" | "amount">): Transaction => ({
  id: ids(),
  payee: "x",
  memo: "",
  categoryId: null,
  ...over,
});

const base = (): Budget => ({
  accounts: [
    { id: "chk", name: "Checking", type: "checking", archived: false },
    { id: "sav", name: "Savings", type: "savings", archived: false },
    { id: "visa", name: "Visa", type: "credit", archived: false },
  ],
  categories: [{ id: "groc", name: "Groceries", group: "Everyday", archived: false }],
  transactions: [],
  assignments: [],
});

/** Ready to Assign + every category's Available must equal what you actually have. */
function expectBalanced(b: Budget, month = "2026-10") {
  const s = summarizeMonth(b, month);
  expect(s.readyToAssign + s.categories.reduce((t, c) => t + c.available, 0)).toBe(netWorth(b));
  expect(transferProblem(b.transactions)).toBeNull();
}

describe("newTransfer", () => {
  it("creates two linked legs that sum to zero", () => {
    const { put } = newTransfer({ fromAccountId: "chk", toAccountId: "sav", date: "2026-10-01", amount: 5000, payee: "Move" }, ids);
    expect(put).toHaveLength(2);
    expect(put[0]!.amount + put[1]!.amount).toBe(0);
    expect(put[0]!.transferId).toBe(put[1]!.id);
    expect(put[1]!.transferId).toBe(put[0]!.id);
    expect(put.every((t) => t.categoryId === TRANSFER)).toBe(true);
    expect(transferProblem(put)).toBeNull();
  });

  it("rejects same-account and non-positive transfers", () => {
    const go = (over: object) => () =>
      newTransfer({ fromAccountId: "chk", toAccountId: "sav", date: "2026-10-01", amount: 100, payee: "x", ...over }, ids);
    expect(go({ toAccountId: "chk" })).toThrow();
    expect(go({ amount: 0 })).toThrow();
    expect(go({ amount: -5 })).toThrow();
  });
});

describe("credit cards and transfers in the budget", () => {
  it("card spending counts when it happens; paying the card changes nothing in the budget", () => {
    let b = base();
    b.transactions.push(txn({ accountId: "chk", date: "2026-10-01", amount: 300000, categoryId: INCOME }));
    b.assignments.push({ month: "2026-10", categoryId: "groc", amount: 40000 });
    b.transactions.push(txn({ accountId: "visa", date: "2026-10-03", amount: -6218, categoryId: "groc" }));

    const before = summarizeMonth(b, "2026-10");
    expect(before.readyToAssign).toBe(260000);
    expect(before.categories[0]!.available).toBe(33782);
    expect(accountBalance(b, "visa")).toBe(-6218);
    expectBalanced(b);

    b = applyChanges(b, newTransfer({ fromAccountId: "chk", toAccountId: "visa", date: "2026-10-20", amount: 6218, payee: "Pay Visa" }, ids));
    const after = summarizeMonth(b, "2026-10");
    expect(after.readyToAssign).toBe(before.readyToAssign);
    expect(after.categories).toEqual(before.categories);
    expect(after.uncategorized).toBe(0);
    expect(accountBalance(b, "visa")).toBe(0);
    expect(accountBalance(b, "chk")).toBe(300000 - 6218);
    expectBalanced(b);
  });

  it("starting card debt comes out of ready to assign", () => {
    const b = base();
    b.transactions.push(
      txn({ accountId: "chk", date: "2026-10-01", amount: 200000, categoryId: INCOME, opening: true }),
      txn({ accountId: "visa", date: "2026-10-01", amount: -85000, categoryId: INCOME, opening: true }),
    );
    expect(summarizeMonth(b, "2026-10").readyToAssign).toBe(115000);
    expectBalanced(b);
  });

  it("transfers are never income for the tax set-aside", () => {
    const b = applyChanges(base(), newTransfer({ fromAccountId: "sav", toAccountId: "chk", date: "2026-10-02", amount: 99999, payee: "x" }, ids));
    expect(incomeForSetAside(b, "2026-10")).toBe(0);
  });
});

describe("linkTransfer", () => {
  it("links to the matching imported row in the other account (closest date, within 5 days)", () => {
    const b = base();
    const payment = txn({ accountId: "chk", date: "2026-10-10", amount: -50000 });
    const far = txn({ accountId: "visa", date: "2026-10-20", amount: 50000, importKey: "far" });
    const close = txn({ accountId: "visa", date: "2026-10-12", amount: 50000, importKey: "close" });
    const wrongAmount = txn({ accountId: "visa", date: "2026-10-10", amount: 49999 });
    b.transactions.push(payment, far, close, wrongAmount);

    const result = applyChanges(b, linkTransfer(b, payment.id, "visa", ids));
    const linked = result.transactions.find((t) => t.id === close.id)!;
    expect(linked).toMatchObject({ categoryId: TRANSFER, transferId: payment.id });
    expect(linked.generated).toBeUndefined();
    expect(result.transactions).toHaveLength(4);
    expectBalanced(result);
  });

  it("creates the other leg when there is no match", () => {
    const b = base();
    const t = txn({ accountId: "chk", date: "2026-10-10", amount: -50000 });
    b.transactions.push(t);
    const result = applyChanges(b, linkTransfer(b, t.id, "sav", ids));
    const other = result.transactions.find((x) => x.accountId === "sav")!;
    expect(other).toMatchObject({ amount: 50000, generated: true, transferId: t.id, date: "2026-10-10" });
    expectBalanced(result);
  });

  it("re-pointing a transfer cleans up the old generated leg", () => {
    let b = base();
    const t = txn({ accountId: "chk", date: "2026-10-10", amount: -50000 });
    b.transactions.push(t);
    b = applyChanges(b, linkTransfer(b, t.id, "sav", ids));
    b = applyChanges(b, linkTransfer(b, t.id, "visa", ids));
    expect(b.transactions.filter((x) => x.accountId === "sav")).toEqual([]);
    expect(b.transactions.filter((x) => x.accountId === "visa")).toHaveLength(1);
    expectBalanced(b);
  });

  it("refuses zero amounts and same-account transfers", () => {
    const b = base();
    const zero = txn({ accountId: "chk", date: "2026-10-10", amount: 0 });
    b.transactions.push(zero);
    expect(() => linkTransfer(b, zero.id, "sav", ids)).toThrow();
    expect(() => linkTransfer(b, zero.id, "chk", ids)).toThrow();
  });

  it("never matches a starting balance or an existing transfer", () => {
    const b = base();
    const t = txn({ accountId: "chk", date: "2026-10-10", amount: -100 });
    b.transactions.push(t, txn({ accountId: "sav", date: "2026-10-10", amount: 100, categoryId: INCOME, opening: true }));
    expect(findCounterpart(b, t, "sav")).toBeUndefined();
  });
});

describe("unlinking and deleting", () => {
  it("unlinking deletes a generated leg but keeps a real one, uncategorized", () => {
    let b = base();
    const a = txn({ accountId: "chk", date: "2026-10-10", amount: -700 });
    const imported = txn({ accountId: "visa", date: "2026-10-11", amount: 700, importKey: "k" });
    b.transactions.push(a, imported);
    b = applyChanges(b, linkTransfer(b, a.id, "visa", ids));
    b = applyChanges(b, unlinkTransfer(b, a.id, "groc"));
    expect(b.transactions.find((x) => x.id === a.id)).toMatchObject({ categoryId: "groc" });
    const kept = b.transactions.find((x) => x.id === imported.id)!;
    expect(kept.categoryId).toBeNull();
    expect(kept.transferId).toBeUndefined();
    expectBalanced(b);

    const c = txn({ accountId: "chk", date: "2026-10-12", amount: -300 });
    b.transactions.push(c);
    b = applyChanges(b, linkTransfer(b, c.id, "sav", ids));
    b = applyChanges(b, unlinkTransfer(b, c.id, null));
    expect(b.transactions.filter((x) => x.accountId === "sav")).toEqual([]);
  });

  it("deleting either side of a transfer entered as one removes both", () => {
    let b = applyChanges(base(), newTransfer({ fromAccountId: "chk", toAccountId: "sav", date: "2026-10-01", amount: 100, payee: "x" }, ids));
    const into = b.transactions.find((t) => t.accountId === "sav")!;
    b = applyChanges(b, deleteTransactionChanges(b, into.id));
    expect(b.transactions).toEqual([]);

    let c = base();
    const t = txn({ accountId: "chk", date: "2026-10-10", amount: -5 });
    c.transactions.push(t);
    c = applyChanges(c, linkTransfer(c, t.id, "sav", ids));
    c = applyChanges(c, deleteTransactionChanges(c, t.id));
    expect(c.transactions).toEqual([]);
  });
});

describe("deleting a linked leg", () => {
  it("keeps an imported partner, uncategorized", () => {
    let b = base();
    const a = txn({ accountId: "chk", date: "2026-10-10", amount: -700, importKey: "bank" });
    const card = txn({ accountId: "visa", date: "2026-10-11", amount: 700, importKey: "card" });
    b.transactions.push(a, card);
    b = applyChanges(b, linkTransfer(b, a.id, "visa", ids));
    b = applyChanges(b, deleteTransactionChanges(b, a.id));
    expect(b.transactions).toEqual([{ ...card, categoryId: null }]);
  });
});

describe("transferProblem", () => {
  const [a, b] = newTransfer({ fromAccountId: "chk", toAccountId: "sav", date: "2026-10-01", amount: 100, payee: "x" }, ids).put as [Transaction, Transaction];
  it.each([
    ["half a transfer", [a]],
    ["one-way link", [a, { ...b, transferId: "other" }]],
    ["same account", [a, { ...b, accountId: "chk" }]],
    ["amount mismatch", [a, { ...b, amount: 99 }]],
    ["transferId without category", [{ ...a, categoryId: null }, b]],
  ])("catches %s", (_name, rows) => {
    expect(transferProblem(rows as Transaction[])).not.toBeNull();
  });
});
