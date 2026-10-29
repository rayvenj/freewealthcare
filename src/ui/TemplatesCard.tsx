import { useState } from "react";
import { newId } from "../core/id";
import { MAX_TEMPLATE_BYTES, parseTemplateJson, planTemplate, type Template } from "../core/templates";
import { putCategories } from "../storage/db";
import { BUILT_IN_TEMPLATES } from "../templates";
import { useStore } from "./store";

export function TemplatesCard() {
  const { budget, mutate } = useStore();
  const [status, setStatus] = useState<string | null>(null);

  async function apply(template: Template) {
    const plan = planTemplate(budget.categories, template, newId);
    if (plan.toPut.length === 0) {
      return setStatus(`"${template.name}" is already in your budget. Nothing to add.`);
    }
    const lines = [
      plan.added.length ? `Add ${plan.added.length} categories: ${plan.added.join(", ")}.` : "",
      plan.updated.length ? `Update ${plan.updated.length}: ${plan.updated.join(", ")}.` : "",
      "Your transactions, balances and assigned money are not changed.",
    ].filter(Boolean);
    if (!confirm(`Apply "${template.name}"?\n\n${lines.join("\n\n")}`)) return;
    const ok = await mutate((db) => putCategories(db, plan.toPut));
    setStatus(
      ok
        ? `Applied "${template.name}": ${plan.added.length} added, ${plan.updated.length} updated. See the Budget tab.`
        : "Template not applied. Nothing was changed.",
    );
  }

  async function openFile(file: File) {
    if (file.size > MAX_TEMPLATE_BYTES) return setStatus("That file is too large to be a template.");
    const result = parseTemplateJson(await file.text());
    if (!result.ok) return setStatus(result.error);
    await apply(result.template);
  }

  return (
    <div className="card">
      <h3>Start from a template</h3>
      <p className="muted">
        Templates add categories only. They never touch your transactions or money.
      </p>
      <ul className="templates">
        {BUILT_IN_TEMPLATES.map((t) => (
          <li key={t.id}>
            <div>
              <strong>{t.name}</strong>
              {t.author && <span className="muted"> by {t.author}</span>}
              <p className="template-desc">{t.description}</p>
              <p className="muted">{t.categories.length} categories</p>
            </div>
            <button className="primary" onClick={() => void apply(t)}>
              Add to my budget
            </button>
          </li>
        ))}
      </ul>
      <label className="file-label">
        Or open a template file
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) openFile(f).catch((err: Error) => setStatus(`Could not open template: ${err.message}`));
            e.target.value = "";
          }}
        />
      </label>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
