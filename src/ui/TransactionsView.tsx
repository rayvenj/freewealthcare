import { useMemo, useState } from "react";
import { detectColumns, importRows, parseCsv } from "../core/csv";
import { isValidIsoDate, todayIso } from "../core/dates";
import { formatCents, parseAmount } from "../core/money";
import { newId } from "../core/id";
import { INCOME } from "../core/types";
import { addImported, deleteTransaction, putTransaction } from "../storage/db";
import { useStore } from "./store";

const MAX_CSV_BYTES = 5 * 1024 * 1024;

export function TransactionsView() {
  const { budget, mutate } = useStore();
  const accounts = budget.accounts.filter((a) => !a.archived);
  const categories = budget.categories.filter((c) => !c.archived);
  const accountName = new Map(budget.accounts.map((a) => [a.id, a.name]));
  const sorted = useMemo(
    () => [...budget.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 500),
    [budget.transactions],
  );

  if (accounts.length === 0) {
    return <p className="empty">Add an account on the Accounts tab before recording transactions.</p>;
  }

  const categorySelect = (value: string | null, onChange: (v: string | null) => void, label: string) => (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Uncategorized</option>
      <option value={INCOME}>Income (ready to assign)</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>{c.group}: {c.name}</option>
      ))}
    </select>
  );

  return (
    <section>
      <h2>Transactions</h2>
      <AddTransaction accounts={accounts} categorySelect={categorySelect} />
      <CsvImport accounts={accounts} />

      {sorted.length === 0 ? (
        <p className="empty">No transactions yet.</p>
      ) : (
        <div className="scroll">
        <table className="txns">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Payee</th>
              <th scope="col">Account</th>
              <th scope="col">Category</th>
              <th scope="col" className="num">Amount</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.payee}{t.memo && <div className="muted">{t.memo}</div>}</td>
                <td>{accountName.get(t.accountId) ?? "?"}</td>
                <td>
                  {categorySelect(
                    t.categoryId,
                    (categoryId) => mutate((db) => putTransaction(db, { ...t, categoryId })),
                    `Category for ${t.payee}`,
                  )}
                </td>
                <td className={`num ${t.amount < 0 ? "out" : "in"}`}>{formatCents(t.amount)}</td>
                <td>
                  <button
                    className="link"
                    aria-label={`Delete ${t.payee} on ${t.date}`}
                    onClick={() => {
                      if (confirm(`Delete ${t.payee} (${formatCents(t.amount)})?`)) {
                        void mutate((db) => deleteTransaction(db, t.id));
                      }
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {budget.transactions.length > 500 && <p className="muted">Showing the 500 most recent.</p>}
    </section>
  );
}

type CategorySelect = (value: string | null, onChange: (v: string | null) => void, label: string) => React.ReactNode;

function AddTransaction(props: { accounts: { id: string; name: string }[]; categorySelect: CategorySelect }) {
  const { mutate } = useStore();
  const [accountId, setAccountId] = useState(props.accounts[0]!.id);
  const [date, setDate] = useState(todayIso());
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = parseAmount(amount);
        if (cents === null || cents === 0) return setError("Enter an amount like 42.50.");
        if (!isValidIsoDate(date)) return setError("Enter a valid date.");
        if (!payee.trim()) return setError("Enter who you paid or who paid you.");
        setError(null);
        const signed = direction === "out" ? -Math.abs(cents) : Math.abs(cents);
        void mutate((db) =>
          putTransaction(db, {
            id: newId(),
            accountId,
            date,
            payee: payee.trim().slice(0, 200),
            memo: "",
            amount: signed,
            categoryId: direction === "in" && categoryId === null ? INCOME : categoryId,
          }),
        );
        setPayee("");
        setAmount("");
      }}
    >
      <h3>Add a transaction</h3>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>
        Account
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {props.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label>Payee<input value={payee} maxLength={200} onChange={(e) => setPayee(e.target.value)} /></label>
      <fieldset className="direction">
        <legend>Type</legend>
        <label><input type="radio" checked={direction === "out"} onChange={() => setDirection("out")} /> Money out</label>
        <label><input type="radio" checked={direction === "in"} onChange={() => setDirection("in")} /> Money in</label>
      </fieldset>
      <label>Amount<input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label>Category{props.categorySelect(categoryId, setCategoryId, "Category")}</label>
      {error && <p role="alert" className="error-text">{error}</p>}
      <button type="submit" className="primary">Add</button>
    </form>
  );
}

function CsvImport(props: { accounts: { id: string; name: string }[] }) {
  const { mutate } = useStore();
  const [accountId, setAccountId] = useState(props.accounts[0]!.id);
  const [status, setStatus] = useState<string | null>(null);

  async function onFile(file: File) {
    if (file.size > MAX_CSV_BYTES) return setStatus("That file is over 5 MB. Split it and try again.");
    const records = parseCsv(await file.text());
    const [header, ...body] = records;
    const map = header ? detectColumns(header) : null;
    if (!map) {
      return setStatus(
        "Couldn't find Date, Description/Payee and Amount (or Debit + Credit) columns in the header row.",
      );
    }
    const { rows, errors } = importRows(body, map, accountId);
    let result = { added: 0, skipped: 0 };
    await mutate(async (db) => {
      result = await addImported(
        db,
        rows.map((r) => ({ id: newId(), accountId, categoryId: null, ...r })),
      );
    });
    setStatus(
      `Imported ${result.added}. Skipped ${result.skipped} already imported.` +
        (errors.length ? ` ${errors.length} row(s) unreadable (first: line ${errors[0]!.line}, ${errors[0]!.message}).` : ""),
    );
  }

  return (
    <div className="card">
      <h3>Import from your bank (CSV)</h3>
      <p className="muted">The file is read in your browser. It is never uploaded.</p>
      <div className="inline-form">
        <select aria-label="Import into account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {props.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
