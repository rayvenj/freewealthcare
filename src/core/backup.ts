import { z } from "zod";
import type { Budget } from "./types";

// A backup file is untrusted input: it may have been edited, corrupted, or
// handed to the user by someone else. Every field is validated and bounded
// before anything touches the database.

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);
const cents = z.number().int().safe();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-\d{2}$/);

const budgetSchema = z.object({
  accounts: z
    .array(
      z.object({
        id,
        name: text(100),
        type: z.enum(["checking", "savings", "cash", "credit"]),
        archived: z.boolean(),
      }),
    )
    .max(500),
  categories: z
    .array(z.object({ id, name: text(100), group: text(100), archived: z.boolean() }))
    .max(1000),
  transactions: z
    .array(
      z.object({
        id,
        accountId: id,
        date: isoDate,
        payee: text(200),
        memo: text(500),
        amount: cents,
        categoryId: id.nullable(),
        importKey: text(400).optional(),
      }),
    )
    .max(200_000),
  assignments: z.array(z.object({ month, categoryId: id, amount: cents })).max(100_000),
});

export const BACKUP_FORMAT = "freewealthcare-backup";
export const BACKUP_VERSION = 1;

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  data: budgetSchema,
});

export function toBackup(budget: Budget, now = new Date()): string {
  return JSON.stringify(
    { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: budget },
    null,
    2,
  );
}

export type ParseBackupResult = { ok: true; budget: Budget } | { ok: false; error: string };

export function parseBackup(json: string): ParseBackupResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Not a valid FreeWealthCare backup${issue ? ` (${issue.path.join(".") || "root"}: ${issue.message})` : ""}.`,
    };
  }
  const data = parsed.data.data;
  const accountIds = new Set(data.accounts.map((a) => a.id));
  const orphan = data.transactions.find((t) => !accountIds.has(t.accountId));
  if (orphan) return { ok: false, error: `Transaction ${orphan.id} points to a missing account.` };
  return {
    ok: true,
    budget: {
      ...data,
      transactions: data.transactions.map(({ importKey, ...t }) =>
        importKey === undefined ? t : { ...t, importKey },
      ),
    },
  };
}
