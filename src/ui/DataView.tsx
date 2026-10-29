import { useState } from "react";
import { parseBackup, toBackup } from "../core/backup";
import { todayIso } from "../core/dates";
import { replaceAll } from "../storage/db";
import { useStore } from "./store";
import { TemplatesCard } from "./TemplatesCard";

const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export function DataView() {
  const { budget, mutate } = useStore();
  const [status, setStatus] = useState<string | null>(null);

  function exportBackup() {
    const blob = new Blob([toBackup(budget)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freewealthcare-backup-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Backup downloaded. Store it somewhere safe: it contains your full financial history, unencrypted.");
  }

  async function restore(file: File) {
    if (file.size > MAX_BACKUP_BYTES) return setStatus("That file is too large to be a FreeWealthCare backup.");
    const result = parseBackup(await file.text());
    if (!result.ok) return setStatus(result.error);
    if (!confirm("Restoring replaces everything currently in this browser. Continue?")) return;
    const ok = await mutate((db) => replaceAll(db, result.budget));
    setStatus(
      ok
        ? `Restored ${result.budget.transactions.length} transactions.`
        : "Restore failed. Your existing budget was left unchanged.",
    );
  }

  return (
    <section>
      <h2>Templates &amp; data</h2>
      <div className="card">
        <h3>Where your data lives</h3>
        <p>
          Everything is stored in this browser on this device. There is no account, no server, and no
          tracking. That also means clearing your browser data deletes your budget, so export a backup
          regularly.
        </p>
      </div>
      <TemplatesCard />
      <div className="card">
        <h3>Back up</h3>
        <button className="primary" onClick={exportBackup}>Download backup</button>
      </div>
      <div className="card">
        <h3>Restore</h3>
        <input
          type="file"
          accept=".json,application/json"
          aria-label="Backup file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) restore(f).catch((err: Error) => setStatus(`Restore failed: ${err.message}`));
            e.target.value = "";
          }}
        />
      </div>
      <div className="card danger">
        <h3>Erase everything</h3>
        <button
          onClick={() => {
            if (confirm("Permanently erase all accounts, transactions and budgets from this browser?")) {
              void mutate((db) =>
                replaceAll(db, { accounts: [], categories: [], transactions: [], assignments: [] }),
              ).then((ok) => setStatus(ok ? "All data erased." : "Erase failed. Your data is unchanged."));
            }
          }}
        >
          Erase all data
        </button>
      </div>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
