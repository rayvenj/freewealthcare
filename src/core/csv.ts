import { normalizeDate } from "./dates";
import { parseAmount, type Cents } from "./money";
import type { IsoDate } from "./types";

/** RFC 4180 CSV parsing: quoted fields, escaped quotes, CRLF, embedded newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export interface ColumnMap {
  date: number;
  payee: number;
  /** Single signed amount column... */
  amount?: number;
  /** ...or separate debit (out) and credit (in) columns. */
  debit?: number;
  credit?: number;
  memo?: number;
}

const HEADER_HINTS: Record<keyof ColumnMap, RegExp> = {
  date: /^(transaction |posted |post )?date$/i,
  payee: /^(payee|description|merchant|name|details)$/i,
  amount: /^(amount|transaction amount)$/i,
  debit: /^(debit|withdrawal|withdrawals|money out)$/i,
  credit: /^(credit|deposit|deposits|money in)$/i,
  memo: /^(memo|notes?|category)$/i,
};

/** Guesses the column layout from a header row. Returns null if it can't be sure. */
export function detectColumns(header: string[]): ColumnMap | null {
  const find = (key: keyof ColumnMap) => {
    const i = header.findIndex((h) => HEADER_HINTS[key].test(h.trim()));
    return i === -1 ? undefined : i;
  };
  const date = find("date");
  const payee = find("payee");
  const amount = find("amount");
  const debit = find("debit");
  const credit = find("credit");
  const memo = find("memo");
  if (date === undefined || payee === undefined) return null;
  if (amount === undefined && (debit === undefined || credit === undefined)) return null;
  return {
    date,
    payee,
    ...(amount !== undefined ? { amount } : { debit: debit!, credit: credit! }),
    ...(memo !== undefined ? { memo } : {}),
  };
}

export interface ImportedRow {
  date: IsoDate;
  payee: string;
  memo: string;
  amount: Cents;
  importKey: string;
}

export interface ImportResult {
  rows: ImportedRow[];
  errors: { line: number; message: string }[];
}

/** Hard ceiling so a malformed or hostile file can't hang the tab. */
export const MAX_IMPORT_ROWS = 20_000;

export function importRows(records: string[][], map: ColumnMap, accountId: string): ImportResult {
  const rows: ImportedRow[] = [];
  const errors: ImportResult["errors"] = [];
  const seen = new Map<string, number>();

  records.slice(0, MAX_IMPORT_ROWS).forEach((r, idx) => {
    const line = idx + 2; // 1-based, after the header row
    const date = normalizeDate(r[map.date] ?? "");
    if (!date) return errors.push({ line, message: `Unrecognized date "${r[map.date] ?? ""}"` });

    let amount: Cents | null;
    if (map.amount !== undefined) {
      amount = parseAmount(r[map.amount] ?? "");
    } else {
      // A blank cell means zero; anything else must parse. Treating garbage as
      // zero would import the other column alone and silently misstate the row.
      const cell = (i: number) => {
        const raw = (r[i] ?? "").trim();
        return raw === "" ? 0 : parseAmount(raw);
      };
      const out = cell(map.debit!);
      const inn = cell(map.credit!);
      amount = out === null || inn === null || (out === 0 && inn === 0) ? null : inn - Math.abs(out);
    }
    if (amount === null) return errors.push({ line, message: "Missing or unreadable amount" });

    const payee = (r[map.payee] ?? "").trim().slice(0, 200);
    const memo = map.memo !== undefined ? (r[map.memo] ?? "").trim().slice(0, 500) : "";

    // Identical rows on the same day are legitimate (two coffees), so the key
    // includes an occurrence counter instead of collapsing them.
    const base = `${accountId}|${date}|${amount}|${payee.toLowerCase()}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    rows.push({ date, payee, memo, amount, importKey: `${base}|${n}` });
  });

  if (records.length > MAX_IMPORT_ROWS) {
    errors.push({ line: MAX_IMPORT_ROWS + 2, message: `Only the first ${MAX_IMPORT_ROWS} rows were read` });
  }
  return { rows, errors };
}
