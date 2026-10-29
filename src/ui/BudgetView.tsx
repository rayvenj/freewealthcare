import { useMemo, useState } from "react";
import { summarizeMonth } from "../core/budget";
import { addMonths, formatMonth, monthOf, todayIso } from "../core/dates";
import { formatCents, parseAmount } from "../core/money";
import { newId } from "../core/id";
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
                  <th scope="row">{c.name}</th>
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

/** Starter groups and categories keep their intended order; anything the user adds sorts after, A to Z. */
function sortCategories(categories: Category[]): Category[] {
  const rank = (list: string[], v: string) => {
    const i = list.indexOf(v);
    return i === -1 ? list.length : i;
  };
  return [...categories].sort(
    (a, b) =>
      rank(STARTER_GROUPS, a.group) - rank(STARTER_GROUPS, b.group) ||
      a.group.localeCompare(b.group) ||
      rank(STARTER_NAMES, a.name) - rank(STARTER_NAMES, b.name) ||
      a.name.localeCompare(b.name),
  );
}
