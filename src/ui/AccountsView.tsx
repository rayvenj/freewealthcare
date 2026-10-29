import { useState } from "react";
import { accountBalance, netWorth } from "../core/budget";
import { todayIso } from "../core/dates";
import { formatCents, parseAmount } from "../core/money";
import { newId } from "../core/id";
import { INCOME, type AccountType } from "../core/types";
import { putAccount, putTransaction } from "../storage/db";
import { useStore } from "./store";

const TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit card" },
];

export function AccountsView() {
  const { budget, mutate } = useStore();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [opening, setOpening] = useState("");
  const [error, setError] = useState<string | null>(null);
  const active = budget.accounts.filter((a) => !a.archived);

  return (
    <section>
      <h2>Accounts</h2>
      <p className="networth">Net worth <strong>{formatCents(netWorth(budget))}</strong></p>
      {active.length === 0 ? (
        <p className="empty">No accounts yet. Add the account you spend from most.</p>
      ) : (
        <ul className="accounts">
          {active.map((a) => (
            <li key={a.id}>
              <span>{a.name} <span className="muted">{TYPES.find((t) => t.value === a.type)?.label}</span></span>
              <strong>{formatCents(accountBalance(budget, a.id))}</strong>
              <button
                className="link"
                onClick={() => {
                  if (confirm(`Archive ${a.name}? Its history stays in your budget.`)) {
                    void mutate((db) => putAccount(db, { ...a, archived: true }));
                  }
                }}
              >
                Archive
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="card form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Name the account.");
          const balance = opening.trim() === "" ? 0 : parseAmount(opening);
          if (balance === null) return setError("Enter the current balance like 1250.00 (negative for card debt).");
          setError(null);
          const id = newId();
          void mutate(async (db) => {
            await putAccount(db, { id, name: name.trim().slice(0, 100), type, archived: false });
            if (balance !== 0) {
              // A positive starting balance is money you have but haven't budgeted
              // yet, so it lands in Ready to Assign. Starting debt is left
              // uncategorized so it visibly reduces what you can assign.
              await putTransaction(db, {
                id: newId(),
                accountId: id,
                date: todayIso(),
                payee: "Starting balance",
                memo: "",
                amount: balance,
                categoryId: balance > 0 ? INCOME : null,
              });
            }
          });
          setName("");
          setOpening("");
        }}
      >
        <h3>Add an account</h3>
        <label>Name<input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></label>
        <label>
          Type
          <select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label>Current balance<input inputMode="decimal" placeholder="0.00" value={opening} onChange={(e) => setOpening(e.target.value)} /></label>
        {error && <p role="alert" className="error-text">{error}</p>}
        <button type="submit" className="primary">Add account</button>
      </form>
    </section>
  );
}
