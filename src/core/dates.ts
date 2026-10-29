import type { IsoDate, Month } from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDate(s: string): s is IsoDate {
  const m = ISO_DATE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function monthOf(date: IsoDate): Month {
  return date.slice(0, 7);
}

export function addMonths(month: Month, delta: number): Month {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}

/** Today in the user's local timezone, which is the day they think they spent the money. */
export function todayIso(now = new Date()): IsoDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatMonth(month: Month, locale = "en-US"): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Normalizes the date formats banks actually export.
 * Accepts YYYY-MM-DD, YYYY/MM/DD and US-style MM/DD/YYYY or MM/DD/YY.
 */
export function normalizeDate(input: string): IsoDate | null {
  const s = input.trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  let iso: string | null = null;
  if (m) iso = `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (m) {
    const year = m[3]!.length === 2 ? `20${m[3]}` : m[3]!;
    iso = `${year}-${m[1]!.padStart(2, "0")}-${m[2]!.padStart(2, "0")}`;
  }
  return iso && isValidIsoDate(iso) ? iso : null;
}
