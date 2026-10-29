import { migrateTransaction } from "./migrate";
import { INCOME, type Transaction } from "./types";

const base: Transaction = {
  id: "t", accountId: "a", date: "2026-10-01", payee: "Starting balance", memo: "", amount: 1_000_000, categoryId: INCOME,
};

describe("migrateTransaction", () => {
  it("flags a v0.1 starting balance", () => {
    expect(migrateTransaction(base)).toEqual({ ...base, opening: true });
  });

  it("is idempotent and leaves current rows untouched", () => {
    const once = migrateTransaction(base);
    expect(migrateTransaction(once)).toBe(once);
  });

  it("never flags imported rows or rows the user wrote", () => {
    const imported = { ...base, importKey: "k" };
    expect(migrateTransaction(imported)).toBe(imported);
    const withMemo = { ...base, memo: "from old bank" };
    expect(migrateTransaction(withMemo)).toBe(withMemo);
    const client = { ...base, payee: "Client A" };
    expect(migrateTransaction(client)).toBe(client);
  });
});
