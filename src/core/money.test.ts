import { formatCents, parseAmount, sum } from "./money";

describe("parseAmount", () => {
  it.each([
    ["12", 1200],
    ["12.5", 1250],
    ["12.05", 1205],
    ["0.1", 10],
    [".99", 99],
    ["-1,234.56", -123456],
    ["$40", 4000],
    ["-$40.00", -4000],
    ["(25.00)", -2500],
    ["  7.00 ", 700],
    ["+3", 300],
  ])("parses %s", (input, cents) => {
    expect(parseAmount(input)).toBe(cents);
  });

  it.each(["", "abc", "1.234", "12,34", "1,2345", "(5", "5)", "--5", "1e5", ".", "$"])(
    "rejects %s",
    (input) => {
      expect(parseAmount(input)).toBeNull();
    },
  );

  it("never produces floating point drift", () => {
    expect(parseAmount("0.1")! + parseAmount("0.2")!).toBe(parseAmount("0.3"));
  });
});

describe("formatCents", () => {
  it("formats USD", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(-5)).toBe("-$0.05");
  });
});

describe("sum", () => {
  it("adds integers exactly", () => {
    expect(sum([10, 20, -5])).toBe(25);
    expect(sum([])).toBe(0);
  });
});
