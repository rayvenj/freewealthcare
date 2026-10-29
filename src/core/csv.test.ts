import { detectColumns, importRows, MAX_IMPORT_ROWS, parseCsv } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, commas, CRLF and a BOM", () => {
    const text = '﻿Date,Description,Amount\r\n2026-10-01,"Joe\'s, ""Best"" Diner",-12.50\r\n';
    expect(parseCsv(text)).toEqual([
      ["Date", "Description", "Amount"],
      ["2026-10-01", 'Joe\'s, "Best" Diner', "-12.50"],
    ]);
  });

  it("keeps newlines inside quoted fields and drops blank lines", () => {
    expect(parseCsv('a,"line1\nline2"\n\n')).toEqual([["a", "line1\nline2"]]);
  });

  it("handles a final row without a trailing newline", () => {
    expect(parseCsv("a,b\nc,d")).toEqual([["a", "b"], ["c", "d"]]);
  });
});

describe("detectColumns", () => {
  it("finds a signed amount layout", () => {
    expect(detectColumns(["Posted Date", "Payee", "Amount", "Memo"])).toEqual({
      date: 0,
      payee: 1,
      amount: 2,
      memo: 3,
    });
  });

  it("finds a debit/credit layout", () => {
    expect(detectColumns(["Date", "Description", "Debit", "Credit"])).toEqual({
      date: 0,
      payee: 1,
      debit: 2,
      credit: 3,
    });
  });

  it("refuses to guess when columns are missing", () => {
    expect(detectColumns(["When", "Who", "How much"])).toBeNull();
    expect(detectColumns(["Date", "Description", "Debit"])).toBeNull();
  });
});

describe("importRows", () => {
  it("imports signed amounts and reports bad lines", () => {
    const { rows, errors } = importRows(
      [
        ["10/01/2026", "Paycheck", "2,500.00"],
        ["10/02/2026", "Coffee", "-4.75"],
        ["not a date", "Bad", "1"],
        ["10/03/2026", "Bad amount", "abc"],
      ],
      { date: 0, payee: 1, amount: 2 },
      "chk",
    );
    expect(rows.map((r) => [r.date, r.payee, r.amount])).toEqual([
      ["2026-10-01", "Paycheck", 250000],
      ["2026-10-02", "Coffee", -475],
    ]);
    expect(errors.map((e) => e.line)).toEqual([4, 5]);
  });

  it("treats debits as outflows regardless of the bank's sign convention", () => {
    const { rows } = importRows(
      [
        ["2026-10-01", "Store", "20.00", ""],
        ["2026-10-01", "Store", "-20.00", ""],
        ["2026-10-02", "Refund", "", "5.00"],
      ],
      { date: 0, payee: 1, debit: 2, credit: 3 },
      "chk",
    );
    expect(rows.map((r) => r.amount)).toEqual([-2000, -2000, 500]);
  });

  it("rejects a row when a populated debit or credit cell is unreadable", () => {
    const { rows, errors } = importRows(
      [
        ["2026-10-01", "Bad debit", "not money", "5.00"],
        ["2026-10-01", "Bad credit", "", "n/a"],
        ["2026-10-01", "Both blank", "", ""],
      ],
      { date: 0, payee: 1, debit: 2, credit: 3 },
      "chk",
    );
    expect(rows).toEqual([]);
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
  });

  it("keeps identical same-day rows distinct and keys them deterministically", () => {
    const records = [
      ["2026-10-01", "Coffee", "-3.00"],
      ["2026-10-01", "Coffee", "-3.00"],
    ];
    const a = importRows(records, { date: 0, payee: 1, amount: 2 }, "chk").rows;
    const b = importRows(records, { date: 0, payee: 1, amount: 2 }, "chk").rows;
    expect(a).toHaveLength(2);
    expect(a[0]!.importKey).not.toBe(a[1]!.importKey);
    expect(a.map((r) => r.importKey)).toEqual(b.map((r) => r.importKey));
  });

  it("caps oversized files", () => {
    const records = Array.from({ length: MAX_IMPORT_ROWS + 5 }, () => ["2026-10-01", "x", "1"]);
    const { rows, errors } = importRows(records, { date: 0, payee: 1, amount: 2 }, "chk");
    expect(rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(errors.at(-1)!.message).toMatch(/Only the first/);
  });
});
