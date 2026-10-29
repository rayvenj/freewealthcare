// All money is stored as integer cents. Floating point never touches a balance:
// 0.1 + 0.2 !== 0.3, and a budget that drifts by a cent is a budget nobody trusts.

export type Cents = number;

const AMOUNT = /^\(?([-+])?\$?\s*(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{0,2}))?\)?$/;

/**
 * Parses a human-typed or bank-exported amount into cents.
 * Accepts "12", "12.5", "-1,234.56", "$40", "(25.00)" (accounting negative).
 * Returns null for anything ambiguous rather than guessing.
 */
export function parseAmount(input: string): Cents | null {
  const raw = input.trim();
  if (raw === "") return null;
  const parens = raw.startsWith("(") && raw.endsWith(")");
  if (raw.startsWith("(") !== raw.endsWith(")")) return null;
  const m = AMOUNT.exec(raw);
  if (!m) return null;
  const [, sign, whole, frac] = m;
  if (whole === undefined && (frac === undefined || frac === "")) return null;
  const dollars = Number((whole ?? "0").replaceAll(",", ""));
  const cents = Number((frac ?? "").padEnd(2, "0") || "0");
  const value = dollars * 100 + cents;
  if (!Number.isSafeInteger(value)) return null;
  const negative = parens || sign === "-";
  return negative ? -value : value;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatCents(cents: Cents, currency = "USD", locale = "en-US"): string {
  const key = `${locale}|${currency}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, { style: "currency", currency });
    formatters.set(key, f);
  }
  return f.format(cents / 100);
}

export function sum(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
