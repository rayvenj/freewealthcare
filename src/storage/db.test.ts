import { addImported, createAccount, loadBudget, openBudgetDb, putAccount, replaceAll, seedIfEmpty, setAssignment } from "./db";

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

  it("seeds once even when two calls race", async () => {
    const db = await fresh();
    await Promise.all([seedIfEmpty(db), seedIfEmpty(db)]);
    const names = (await loadBudget(db)).categories.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("creates an account and its starting balance together, or neither", async () => {
    const db = await fresh();
    const opening = {
      id: "t1", accountId: "a", date: "2026-10-01", payee: "Starting balance", memo: "",
      amount: 500, categoryId: "income", opening: true as const,
    };
    await createAccount(db, { id: "a", name: "A", type: "checking", archived: false }, opening);
    expect((await loadBudget(db)).transactions).toHaveLength(1);

    // A transaction id that collides with nothing but a unique import key that does:
    await createAccount(db, { id: "b", name: "B", type: "checking", archived: false }, {
      ...opening, id: "t2", accountId: "b", importKey: "dup",
    });
    await expect(
      createAccount(db, { id: "c", name: "C", type: "checking", archived: false }, {
        ...opening, id: "t3", accountId: "c", importKey: "dup",
      }),
    ).rejects.toThrow();
    const after = await loadBudget(db);
    expect(after.accounts.map((a) => a.id).sort()).toEqual(["a", "b"]);
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
