import { addImported, loadBudget, openBudgetDb, putAccount, replaceAll, seedIfEmpty, setAssignment } from "./db";

let dbCount = 0;
const fresh = () => openBudgetDb(`test-${++dbCount}`);

describe("storage", () => {
  it("seeds starter categories once", async () => {
    const db = await fresh();
    await seedIfEmpty(db);
    const first = (await loadBudget(db)).categories.length;
    await seedIfEmpty(db);
    expect(first).toBeGreaterThan(0);
    expect((await loadBudget(db)).categories).toHaveLength(first);
  });

  it("sets, overwrites and clears assignments", async () => {
    const db = await fresh();
    await setAssignment(db, { month: "2026-10", categoryId: "c", amount: 100 });
    await setAssignment(db, { month: "2026-10", categoryId: "c", amount: 250 });
    expect((await loadBudget(db)).assignments).toEqual([{ month: "2026-10", categoryId: "c", amount: 250 }]);
    await setAssignment(db, { month: "2026-10", categoryId: "c", amount: 0 });
    expect((await loadBudget(db)).assignments).toEqual([]);
  });

  it("skips rows already imported", async () => {
    const db = await fresh();
    await putAccount(db, { id: "a", name: "A", type: "checking", archived: false });
    const row = (id: string, importKey: string) => ({
      id, accountId: "a", date: "2026-10-01", payee: "x", memo: "", amount: -1, categoryId: null, importKey,
    });
    expect(await addImported(db, [row("1", "k1"), row("2", "k2")])).toEqual({ added: 2, skipped: 0 });
    expect(await addImported(db, [row("3", "k1"), row("4", "k3")])).toEqual({ added: 1, skipped: 1 });
    expect((await loadBudget(db)).transactions).toHaveLength(3);
  });

  it("replaces everything atomically", async () => {
    const db = await fresh();
    await seedIfEmpty(db);
    await replaceAll(db, {
      accounts: [{ id: "a", name: "A", type: "cash", archived: false }],
      categories: [],
      transactions: [],
      assignments: [],
    });
    const b = await loadBudget(db);
    expect(b.accounts).toHaveLength(1);
    expect(b.categories).toHaveLength(0);
  });
});
