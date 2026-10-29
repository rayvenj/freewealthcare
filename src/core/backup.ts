import { z } from "zod";
import { isValidIsoDate } from "./dates";
import { MAX_SET_ASIDE_RATE } from "./templates";
import { INCOME, type Budget, type Category, type Transaction } from "./types";

// A backup file is untrusted input: it may have been edited, corrupted, or
// handed to the user by someone else. Every field is validated and bounded
// before anything touches the database.

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);
const cents = z.number().int().safe();
const isoDate = z.string().refine(isValidIsoDate, "Not a real calendar date");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Not a valid month");

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
    .array(
      z.object({
        id,
        name: text(100),
        group: text(100),
        archived: z.boolean(),
        setAsideRate: z.number().int().min(1).max(MAX_SET_ASIDE_RATE).optional(),
      }),
    )
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
        opening: z.literal(true).optional(),
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
  const problem = findIntegrityProblem(data);
  if (problem) return { ok: false, error: `Not a valid FreeWealthCare backup (${problem}).` };
  return {
    ok: true,
    budget: {
      ...data,
      categories: data.categories.map(({ setAsideRate, ...c }) => {
        const out: Category = { ...c };
        if (setAsideRate !== undefined) out.setAsideRate = setAsideRate;
        return out;
      }),
      transactions: data.transactions.map(({ importKey, opening, ...t }) => {
        const out: Transaction = { ...t };
        if (importKey !== undefined) out.importKey = importKey;
        if (opening) out.opening = true;
        return out;
      }),
    },
  };
}

/**
 * Relationship checks the schema can't express. Each one protects the budget
 * invariant or the database: an unknown category would move account balances
 * without showing up in any budget row, and a duplicate key would silently
 * overwrite a record (or fail the unique import index) during restore.
 */
function findIntegrityProblem(data: z.infer<typeof budgetSchema>): string | null {
  const dupe = (values: string[]) => {
    const seen = new Set<string>();
    for (const v of values) {
      if (seen.has(v)) return v;
      seen.add(v);
    }
    return null;
  };

  const accountIds = new Set(data.accounts.map((a) => a.id));
  const categoryIds = new Set(data.categories.map((c) => c.id));

  let d = dupe(data.accounts.map((a) => a.id));
  if (d) return `duplicate account id ${d}`;
  d = dupe(data.categories.map((c) => c.id));
  if (d) return `duplicate category id ${d}`;
  if (categoryIds.has(INCOME)) return `"${INCOME}" is reserved and can't be a category id`;
  d = dupe(data.transactions.map((t) => t.id));
  if (d) return `duplicate transaction id ${d}`;
  d = dupe(data.transactions.flatMap((t) => (t.importKey === undefined ? [] : [t.importKey])));
  if (d) return `duplicate import key ${d}`;
  d = dupe(data.assignments.map((a) => `${a.month} ${a.categoryId}`));
  if (d) return `more than one assignment for ${d}`;

  for (const t of data.transactions) {
    if (!accountIds.has(t.accountId)) return `transaction ${t.id} points to a missing account`;
    if (t.categoryId !== null && t.categoryId !== INCOME && !categoryIds.has(t.categoryId)) {
      return `transaction ${t.id} points to a missing category`;
    }
  }
  for (const a of data.assignments) {
    if (!categoryIds.has(a.categoryId)) return `assignment for ${a.month} points to a missing category`;
  }
  return null;
}
