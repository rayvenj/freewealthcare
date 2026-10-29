import { useCallback, useEffect, useState } from "react";
import type { Budget } from "../core/types";
import { loadBudget, openBudgetDb, seedIfEmpty, type Db } from "../storage/db";
import { StoreContext } from "./store";
import { BudgetView } from "./BudgetView";
import { TransactionsView } from "./TransactionsView";
import { AccountsView } from "./AccountsView";
import { DataView } from "./DataView";

// A plain outbound link only. No embeds or signup forms: the CSP forbids the app
// from making network requests, and that promise matters more than conversion.
export const NEWSLETTER_URL = "https://universalwealthcare.substack.com/";

const TABS = ["Budget", "Transactions", "Accounts", "Templates & data"] as const;
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
      if (!db) return false;
      let ok = true;
      try {
        await write(db);
      } catch (e) {
        ok = false;
        setError(`Not saved: ${(e as Error).message}`);
      }
      try {
        setBudget(await loadBudget(db));
      } catch (e) {
        setError(`Could not reload your budget: ${(e as Error).message}`);
        return false;
      }
      return ok;
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
        {tab === "Templates & data" && <DataView />}
      </main>
      <footer className="shell footer">
        <p>Your data is stored only in this browser. Nothing is sent anywhere.</p>
        <p>
          An educational tool, not financial, tax or investment advice. Built in public; follow along at{" "}
          <a href={NEWSLETTER_URL} target="_blank" rel="noopener noreferrer">
            Universal WealthCare
          </a>
          .
        </p>
      </footer>
    </StoreContext.Provider>
  );
}
