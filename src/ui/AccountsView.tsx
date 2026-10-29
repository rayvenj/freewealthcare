import { useState } from "react";
import { accountBalance, netWorth } from "../core/budget";
import { todayIso } from "../core/dates";
import { formatCents, parseAmount } from "../core/money";
import { newId } from "../core/id";
import { newTransfer } from "../core/transfers";
import { INCOME, type Account, type AccountType } from "../core/types";
import { applyTransactionChanges, createAccount, putAccount } from "../storage/db";
import { useStore } from "./store";

const TYPES: { value: AccountType; label: string }[] = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "cash", label: "Cash" },
  { value: "credit", label: "Credit card" },
];

const TYPE_ORDER = TYPES.map((t) => t.value);

export function AccountsView() {
  const { budget, mutate } = useStore();
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("checking");
  const [opening, setOpening] = useState("");
  const [error, setError] = useState<string | null>(null);
  const active = budget.accounts
    .filter((a) => !a.archived)
    .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name));
  const payFrom = active.filter((a) => a.type !== "credit");
  const isCard = type === "credit";

  return (
    <section>
      <h2>Accounts</h2>
      <p className="networth">Net worth <strong>{formatCents(netWorth(budget))}</strong></p>
      {active.length === 0 ? (
        <p className="empty">No accounts yet. Add the account you spend from most.</p>
      ) : (
        <ul className="accounts">
          {active.map((a) => {
            const balance = accountBalance(budget, a.id);
            return (
              <li key={a.id}>
                <div className="account-row">
                  <span>
                    {a.name} <span className="muted">{TYPES.find((t) => t.value === a.type)?.label}</span>
                  </span>
                  {a.type === "credit" ? (
                    <strong className={balance < 0 ? "out" : ""}>
                      {balance < 0 ? `Owed ${formatCents(-balance)}` : balance === 0 ? "Paid off" : `Credit ${formatCents(balance)}`}
                    </strong>
                  ) : (
                    <strong>{formatCents(balance)}</strong>
                  )}
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
                </div>
                {a.type === "credit" && balance < 0 && payFrom.length > 0 && (
                  <PayCard card={a} owed={-balance} payFrom={payFrom} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="card form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Name the account.");
          const entered = opening.trim() === "" ? 0 : parseAmount(opening);
          if (entered === null) {
            return setError(isCard ? "Enter what you owe, like 850.00." : "Enter the current balance, like 1250.00.");
          }
          setError(null);
          // For a card the form asks what you owe, which is a negative balance.
          const balance = isCard ? -Math.abs(entered) : entered;
          const id = newId();
          const openingTxn =
            balance === 0
              ? undefined
              : {
                  id: newId(),
                  accountId: id,
                  date: todayIso(),
                  payee: "Starting balance",
                  memo: "",
                  amount: balance,
                  // Money you already have goes to Ready to Assign; debt you
                  // already owe comes out of it, so your budget has to cover it.
                  categoryId: INCOME,
                  opening: true as const,
                };
          void mutate((db) =>
            createAccount(db, { id, name: name.trim().slice(0, 100), type, archived: false }, openingTxn),
          ).then((ok) => {
            if (ok) {
              setName("");
              setOpening("");
            }
          });
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
        <label>
          {isCard ? "Amount owed" : "Current balance"}
          <input inputMode="decimal" placeholder="0.00" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </label>
        {isCard && (
          <p className="muted form-note">
            Debt you already owe comes out of Ready to Assign. New card purchases are budgeted like cash: pick a
            category and it's covered. Paying the card is a transfer, not spending.
          </p>
        )}
        {error && <p role="alert" className="error-text">{error}</p>}
        <button type="submit" className="primary">Add account</button>
      </form>
    </section>
  );
}

/** "Pay this card" shortcut: records a transfer from a cash account to the card. */
function PayCard(props: { card: Account; owed: number; payFrom: Account[] }) {
  const { mutate } = useStore();
  const [fromId, setFromId] = useState(props.payFrom[0]!.id);
  const [amount, setAmount] = useState((props.owed / 100).toFixed(2));
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="pay-card"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = parseAmount(amount);
        if (cents === null || cents <= 0) return setError("Enter a payment amount.");
        setError(null);
        void mutate((db) =>
          applyTransactionChanges(
            db,
            newTransfer(
              { fromAccountId: fromId, toAccountId: props.card.id, date: todayIso(), amount: cents, payee: `Payment to ${props.card.name}` },
              newId,
            ),
          ),
        );
      }}
    >
      <span className="muted">Pay</span>
      <input
        className="amount"
        inputMode="decimal"
        aria-label={`Payment amount for ${props.card.name}`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <span className="muted">from</span>
      <select aria-label={`Pay ${props.card.name} from`} value={fromId} onChange={(e) => setFromId(e.target.value)}>
        {props.payFrom.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button type="submit">Pay card</button>
      {error && <span role="alert" className="error-text">{error}</span>}
    </form>
  );
}
