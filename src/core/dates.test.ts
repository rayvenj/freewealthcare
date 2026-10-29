import { addMonths, isValidIsoDate, monthOf, normalizeDate, todayIso } from "./dates";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-1-01")).toBe(false);
  });

  it("adds months across year boundaries", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-10", 14)).toBe("2027-12");
  });

  it("extracts the month", () => {
    expect(monthOf("2026-10-29")).toBe("2026-10");
  });

  it("uses local time for today", () => {
    expect(todayIso(new Date(2026, 9, 29, 23, 59))).toBe("2026-10-29");
  });

  it.each([
    ["2026-10-29", "2026-10-29"],
    ["2026/10/29", "2026-10-29"],
    ["10/29/2026", "2026-10-29"],
    ["1/5/26", "2026-01-05"],
    ["02/30/2026", null],
    ["29/10/2026", null],
    ["yesterday", null],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeDate(input)).toBe(expected);
  });
});
