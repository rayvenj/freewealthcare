import { useCallback, useEffect, useState } from "react";
import type { Budget } from "../core/types";
import { loadBudget, openBudgetDb, seedIfEmpty, type Db } from "../storage/db";
import { StoreContext } from "./store";
import { BudgetView } from "./BudgetView";
import { TransactionsView } from "./TransactionsView";
import { AccountsView } from "./AccountsView";
import { DataView } from "./DataView";

const TABS = ["Budget", "Transactions", "Accounts", "Your data"] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Budget");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opened = await openBudgetDb();
        await seedIfEmpty(opened);
        const loaded = await loadBudget(opened);
        if (!cancelled) {
          setDb(opened);
          setBudget(loaded);
        }
      } catch (e) {
        if (!cancelled) setError(`Could not open local storage: ${(e as Error).message}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mutate = useCallback(
    async (write: (db: Db) => Promise<unknown>) => {
      if (!db) return;
      try {
        await write(db);
      } catch (e) {
        setError((e as Error).message);
      }
      setBudget(await loadBudget(db));
    },
    [db],
  );

  if (error && !budget) return <main className="shell"><p role="alert">{error}</p></main>;
  if (!db || !budget) return <main className="shell"><p>Loading…</p></main>;

  return (
    <StoreContext.Provider value={{ db, budget, mutate }}>
      <header className="topbar">
        <div className="shell topbar-inner">
          <h1 className="brand">FreeWealthCare</h1>
          <nav aria-label="Main">
            {TABS.map((t) => (
              <button
                key={t}
                className={t === tab ? "tab active" : "tab"}
                aria-current={t === tab ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="shell">
        {error && (
          <p role="alert" className="banner error">
            {error} <button className="link" onClick={() => setError(null)}>Dismiss</button>
          </p>
        )}
        {tab === "Budget" && <BudgetView />}
        {tab === "Transactions" && <TransactionsView />}
        {tab === "Accounts" && <AccountsView />}
        {tab === "Your data" && <DataView />}
      </main>
      <footer className="shell footer">
        Your data is stored only in this browser. Nothing is sent anywhere.
      </footer>
    </StoreContext.Provider>
  );
}
