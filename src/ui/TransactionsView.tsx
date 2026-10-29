import { useMemo, useState } from "react";
import { detectColumns, importRows, parseCsv } from "../core/csv";
import { isValidIsoDate, todayIso } from "../core/dates";
import { formatCents, parseAmount } from "../core/money";
import { newId } from "../core/id";
import { counterpartOf, deleteTransactionChanges, linkTransfer, newTransfer, unlinkTransfer, type Changes } from "../core/transfers";
import { INCOME, TRANSFER, type Account, type Transaction } from "../core/types";
import { addImported, applyTransactionChanges, putTransaction } from "../storage/db";
import { useStore } from "./store";

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const PAGE = 500;

export function TransactionsView() {
  const { budget, mutate } = useStore();
  const accounts = budget.accounts.filter((a) => !a.archived);
  const categories = budget.categories.filter((c) => !c.archived);
  const accountName = new Map(budget.accounts.map((a) => [a.id, a.name]));
  const [onlyUncategorized, setOnlyUncategorized] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const matching = useMemo(
    () =>
      budget.transactions
        .filter((t) => !onlyUncategorized || t.categoryId === null)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [budget.transactions, onlyUncategorized],
  );
  const shown = matching.slice(0, limit);
  const uncategorizedCount = budget.transactions.filter((t) => t.categoryId === null).length;

  const categorySelect = (value: string | null, onChange: (v: string | null) => void, label: string) => (
    <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <CategoryOptions categories={categories} />
    </select>
  );

  const apply = (changes: Changes) => mutate((db) => applyTransactionChanges(db, changes));

  /** Category picker for an existing row, which can also turn it into (or out of) a transfer. */
  const rowSelect = (t: Transaction) => {
    const other = counterpartOf(budget, t);
    const value = t.categoryId === TRANSFER && other ? `${TRANSFER_PREFIX}${other.accountId}` : (t.categoryId ?? "");
    // Every account except this one can be the other side; keep the current one even if archived.
    const targets = budget.accounts.filter((a) => a.id !== t.accountId && (!a.archived || a.id === other?.accountId));
    return (
      <select
        aria-label={`Category for ${t.payee}`}
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          try {
            if (next.startsWith(TRANSFER_PREFIX)) {
              void apply(linkTransfer(budget, t.id, next.slice(TRANSFER_PREFIX.length), newId));
            } else if (t.categoryId === TRANSFER) {
              void apply(unlinkTransfer(budget, t.id, next || null));
            } else {
              void mutate((db) => putTransaction(db, { ...t, categoryId: next || null }));
            }
          } catch (err) {
            alert((err as Error).message);
          }
        }}
      >
        <CategoryOptions categories={categories} />
        {targets.length > 0 && (
          <optgroup label="Transfer (not spending)">
            {targets.map((a) => (
              <option key={a.id} value={`${TRANSFER_PREFIX}${a.id}`}>
                Transfer {t.amount < 0 ? "to" : "from"} {a.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    );
  };

  const accountCell = (t: Transaction) => {
    const other = counterpartOf(budget, t);
    const here = accountName.get(t.accountId) ?? "?";
    if (t.categoryId !== TRANSFER || !other) return here;
    const there = accountName.get(other.accountId) ?? "?";
    return t.amount < 0 ? `${here} → ${there}` : `${there} → ${here}`;
  };

  return (
    <section>
      <h2>Transactions</h2>
      {accounts.length === 0 ? (
        <p className="empty">Add an account on the Accounts tab to record or import transactions.</p>
      ) : (
        <>
          <AddTransaction accounts={accounts} categorySelect={categorySelect} />
          <CsvImport accounts={accounts} />
        </>
      )}

      {budget.transactions.length > 0 && (
        <label className="filter">
          <input
            type="checkbox"
            checked={onlyUncategorized}
            onChange={(e) => {
              setOnlyUncategorized(e.target.checked);
              setLimit(PAGE);
            }}
          />{" "}
          Only uncategorized ({uncategorizedCount})
        </label>
      )}

      {shown.length === 0 ? (
        <p className="empty">{onlyUncategorized ? "Everything has a category." : "No transactions yet."}</p>
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
            {shown.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>{t.payee}{t.memo && <div className="muted">{t.memo}</div>}</td>
                <td>{accountCell(t)}</td>
                <td>{rowSelect(t)}</td>
                <td className={`num ${t.amount < 0 ? "out" : "in"}`}>{formatCents(t.amount)}</td>
                <td>
                  <button
                    className="link"
                    aria-label={`Delete ${t.payee} on ${t.date}`}
                    onClick={() => {
                      const other = counterpartOf(budget, t);
                      const extra = !other
                        ? ""
                        : other.generated
                          ? " This is a transfer, so the matching entry in the other account is deleted too."
                          : " This is a transfer. The matching entry in the other account is kept and marked uncategorized.";
                      if (confirm(`Delete ${t.payee} (${formatCents(t.amount)})?${extra}`)) {
                        void apply(deleteTransactionChanges(budget, t.id));
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
      {matching.length > shown.length && (
        <p className="muted">
          Showing {shown.length} of {matching.length}.{" "}
          <button className="link" onClick={() => setLimit((n) => n + PAGE)}>
            Show {Math.min(PAGE, matching.length - shown.length)} more
          </button>
        </p>
      )}
    </section>
  );
}

const TRANSFER_PREFIX = "transfer:";

function CategoryOptions(props: { categories: { id: string; name: string; group: string }[] }) {
  return (
    <>
      <option value="">Uncategorized</option>
      <option value={INCOME}>Income (ready to assign)</option>
      {props.categories.map((c) => (
        <option key={c.id} value={c.id}>{c.group}: {c.name}</option>
      ))}
    </>
  );
}

type CategorySelect = (value: string | null, onChange: (v: string | null) => void, label: string) => React.ReactNode;

function AddTransaction(props: { accounts: Account[]; categorySelect: CategorySelect }) {
  const { mutate } = useStore();
  const [accountId, setAccountId] = useState(props.accounts[0]!.id);
  const [toAccountId, setToAccountId] = useState(props.accounts[1]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"out" | "in" | "transfer">("out");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isTransfer = direction === "transfer";
  const canTransfer = props.accounts.length > 1;

  return (
    <form
      className="card form-grid"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = parseAmount(amount);
        if (cents === null || cents === 0) return setError("Enter an amount like 42.50.");
        if (!isValidIsoDate(date)) return setError("Enter a valid date.");
        if (!isTransfer && !payee.trim()) return setError("Enter who you paid or who paid you.");
        if (isTransfer && (!toAccountId || toAccountId === accountId)) return setError("Pick two different accounts.");
        setError(null);
        const saved = isTransfer
          ? mutate((db) =>
              applyTransactionChanges(
                db,
                newTransfer(
                  { fromAccountId: accountId, toAccountId, date, amount: Math.abs(cents), payee: payee.trim().slice(0, 200) || "Transfer" },
                  newId,
                ),
              ),
            )
          : mutate((db) =>
              putTransaction(db, {
                id: newId(),
                accountId,
                date,
                payee: payee.trim().slice(0, 200),
                memo: "",
                amount: direction === "out" ? -Math.abs(cents) : Math.abs(cents),
                categoryId: direction === "in" && categoryId === null ? INCOME : categoryId,
              }),
            );
        void saved.then((ok) => {
          if (ok) {
            setPayee("");
            setAmount("");
          }
        });
      }}
    >
      <h3>Add a transaction</h3>
      <label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>
        {isTransfer ? "From account" : "Account"}
        <select
          value={accountId}
          onChange={(e) => {
            const from = e.target.value;
            setAccountId(from);
            if (toAccountId === from) setToAccountId(props.accounts.find((a) => a.id !== from)?.id ?? "");
          }}
        >
          {props.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      {isTransfer && (
        <label>
          To account
          <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            {props.accounts.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
      )}
      <label>
        {isTransfer ? "Description (optional)" : "Payee"}
        <input value={payee} maxLength={200} onChange={(e) => setPayee(e.target.value)} />
      </label>
      <fieldset className="direction">
        <legend>Type</legend>
        <label><input type="radio" checked={direction === "out"} onChange={() => setDirection("out")} /> Money out</label>
        <label><input type="radio" checked={direction === "in"} onChange={() => setDirection("in")} /> Money in</label>
        {canTransfer && (
          <label>
            <input
              type="radio"
              checked={isTransfer}
              onChange={() => {
                setDirection("transfer");
                if (!toAccountId || toAccountId === accountId) {
                  setToAccountId(props.accounts.find((a) => a.id !== accountId)!.id);
                }
              }}
            />{" "}
            Transfer
          </label>
        )}
      </fieldset>
      <label>Amount<input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      {isTransfer ? (
        <p className="muted form-note">
          Moves money between your accounts, like paying a credit card. Not spending, so your budget doesn't change.
        </p>
      ) : (
        <label>Category{props.categorySelect(categoryId, setCategoryId, "Category")}</label>
      )}
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
    const ok = await mutate(async (db) => {
      result = await addImported(
        db,
        rows.map((r) => ({ id: newId(), accountId, categoryId: null, ...r })),
      );
    });
    if (!ok) return setStatus("Import failed. Nothing was saved.");
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
            if (f) onFile(f).catch((err: Error) => setStatus(`Import failed: ${err.message}`));
            e.target.value = "";
          }}
        />
      </div>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
