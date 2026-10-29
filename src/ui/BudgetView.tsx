import { useMemo, useState } from "react";
import { summarizeMonth } from "../core/budget";
import { addMonths, formatMonth, monthOf, todayIso } from "../core/dates";
import { formatCents, parseAmount } from "../core/money";
import { newId } from "../core/id";
import { formatRate, incomeForSetAside, MAX_SET_ASIDE_RATE, setAsideAmount } from "../core/templates";
import { DEFAULT_CATEGORIES, putCategory, setAssignment } from "../storage/db";
import type { Category } from "../core/types";
import { useStore } from "./store";

export function BudgetView() {
  const { budget, mutate } = useStore();
  const [month, setMonth] = useState(monthOf(todayIso()));
  const summary = useMemo(() => summarizeMonth(budget, month), [budget, month]);
  const byId = new Map(summary.categories.map((c) => [c.categoryId, c]));

  const groups = new Map<string, typeof budget.categories>();
  for (const c of sortCategories(budget.categories.filter((c) => !c.archived))) {
    groups.set(c.group, [...(groups.get(c.group) ?? []), c]);
  }

  const rta = summary.readyToAssign;
  const setAsideIncome = useMemo(() => incomeForSetAside(budget, month), [budget, month]);

  return (
    <section>
      <div className="month-nav">
        <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">‹</button>
        <h2>{formatMonth(month)}</h2>
        <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">›</button>
      </div>

      <div className={`rta ${rta < 0 ? "negative" : rta === 0 ? "zero" : ""}`}>
        <span className="rta-label">Ready to assign</span>
        <strong className="rta-value">{formatCents(rta)}</strong>
        <span className="rta-hint">
          {rta > 0 && "Give every dollar a job."}
          {rta === 0 && "Every dollar has a job."}
          {rta < 0 && "You've assigned more than you have. Pull money back from a category."}
        </span>
      </div>

      {summary.uncategorized !== 0 && (
        <p className="banner warn">
          {formatCents(summary.uncategorized)} of activity this month has no category yet.
        </p>
      )}

      <div className="scroll">
      <table className="budget">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" className="num">Assigned</th>
            <th scope="col" className="num activity">Activity</th>
            <th scope="col" className="num">Available</th>
          </tr>
        </thead>
        {[...groups].map(([group, cats]) => (
          <tbody key={group}>
            <tr className="group-row">
              <th colSpan={4} scope="colgroup">{group}</th>
            </tr>
            {cats.map((c) => {
              const row = byId.get(c.id);
              return (
                <tr key={c.id}>
                  <th scope="row">
                    {c.name}
                    {c.setAsideRate !== undefined && (
                      <SetAside
                        category={c}
                        income={setAsideIncome}
                        assigned={row?.assigned ?? 0}
                        onAssign={(amount) =>
                          mutate((db) => setAssignment(db, { month, categoryId: c.id, amount }))
                        }
                        onRate={(rate) => {
                          void mutate((db) => putCategory(db, { ...c, setAsideRate: rate }));
                        }}
                      />
                    )}
                  </th>
                  <td className="num">
                    <AssignInput
                      key={`${c.id}-${month}-${row?.assigned ?? 0}`}
                      label={`Assigned to ${c.name}`}
                      value={row?.assigned ?? 0}
                      onCommit={(amount) =>
                        mutate((db) => setAssignment(db, { month, categoryId: c.id, amount }))
                      }
                    />
                  </td>
                  <td className="num activity">{formatCents(row?.activity ?? 0)}</td>
                  <td className="num">
                    <span className={`pill ${(row?.available ?? 0) < 0 ? "neg" : (row?.available ?? 0) > 0 ? "pos" : ""}`}>
                      {formatCents(row?.available ?? 0)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
      </div>

      <AddCategory
        groups={[...groups.keys()]}
        onAdd={(name, group) =>
          mutate((db) => putCategory(db, { id: newId(), name, group, archived: false }))
        }
      />
    </section>
  );
}

function AssignInput(props: { label: string; value: number; onCommit: (cents: number) => void }) {
  const [text, setText] = useState(props.value ? (props.value / 100).toFixed(2) : "");
  const [invalid, setInvalid] = useState(false);
  const commit = () => {
    const cents = text.trim() === "" ? 0 : parseAmount(text);
    if (cents === null) return setInvalid(true);
    setInvalid(false);
    if (cents !== props.value) props.onCommit(cents);
  };
  return (
    <input
      className={`amount ${invalid ? "invalid" : ""}`}
      inputMode="decimal"
      aria-label={props.label}
      aria-invalid={invalid}
      placeholder="0.00"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

function AddCategory(props: { groups: string[]; onAdd: (name: string, group: string) => void }) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState(props.groups[0] ?? "Everyday");
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        props.onAdd(name.trim().slice(0, 100), group.trim().slice(0, 100) || "Everyday");
        setName("");
      }}
    >
      <input aria-label="New category name" placeholder="New category" value={name} onChange={(e) => setName(e.target.value)} />
      <input aria-label="Group" list="category-groups" value={group} onChange={(e) => setGroup(e.target.value)} />
      <datalist id="category-groups">
        {props.groups.map((g) => <option key={g} value={g} />)}
      </datalist>
      <button type="submit">Add category</button>
    </form>
  );
}

const STARTER_GROUPS = DEFAULT_CATEGORIES.map(([g]) => g);
const STARTER_NAMES = DEFAULT_CATEGORIES.flatMap(([, names]) => names);

/**
 * Groups holding a set-aside (like quarterly taxes) come first: that money has
 * to be put away before anything else. Then starter groups and categories in
 * their intended order, then anything the user added, A to Z.
 */
function sortCategories(categories: Category[]): Category[] {
  const rank = (list: string[], v: string) => {
    const i = list.indexOf(v);
    return i === -1 ? list.length : i;
  };
  const setAsideGroups = new Set(categories.filter((c) => c.setAsideRate).map((c) => c.group));
  const first = (c: Category) => (setAsideGroups.has(c.group) ? 0 : 1);
  return [...categories].sort(
    (a, b) =>
      first(a) - first(b) ||
      rank(STARTER_GROUPS, a.group) - rank(STARTER_GROUPS, b.group) ||
      a.group.localeCompare(b.group) ||
      rank(STARTER_NAMES, a.name) - rank(STARTER_NAMES, b.name) ||
      a.name.localeCompare(b.name),
  );
}

/**
 * "Set aside 25% of income" prompt for categories like quarterly taxes. It only
 * suggests: nothing is assigned until the user presses the button.
 */
function SetAside(props: {
  category: Category;
  income: number;
  assigned: number;
  onAssign: (cents: number) => void;
  /** 0 records an explicit "off", so a template can't quietly switch it back on. */
  onRate: (rateBps: number) => void;
}) {
  const rate = props.category.setAsideRate ?? 0;
  const suggested = setAsideAmount(props.income, rate);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(String(rate / 100));

  if (editing) {
    return (
      <form
        className="set-aside"
        onSubmit={(e) => {
          e.preventDefault();
          const pct = Number(text);
          if (!Number.isFinite(pct) || pct < 0 || pct * 100 > MAX_SET_ASIDE_RATE) return;
          props.onRate(Math.round(pct * 100));
          setEditing(false);
        }}
      >
        <input
          className="rate"
          inputMode="decimal"
          aria-label={`Set-aside percent for ${props.category.name}`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        % <button type="submit" className="link">Save</button>
        <span className="muted"> (0 turns it off)</span>
      </form>
    );
  }

  if (rate === 0) {
    return (
      <div className="set-aside">
        <span className="muted">Set-aside off</span>
        <button className="link" aria-label={`Change set-aside percent for ${props.category.name}`} onClick={() => setEditing(true)}>
          Change
        </button>
      </div>
    );
  }

  return (
    <div className="set-aside">
      <span className="muted">
        Set aside {formatRate(rate)} of income
        {props.income > 0 && <> = {formatCents(suggested)}</>}
      </span>
      {props.income > 0 && props.assigned < suggested && (
        <button className="link" onClick={() => props.onAssign(suggested)}>
          Assign {formatCents(suggested)}
        </button>
      )}
      {props.income > 0 && props.assigned >= suggested && <span className="covered">Covered</span>}
      <button className="link" aria-label={`Change set-aside percent for ${props.category.name}`} onClick={() => setEditing(true)}>
        Change
      </button>
    </div>
  );
}
