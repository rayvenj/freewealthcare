import published from "../../public/templates/1099-contractor.json?raw";
import contractor from "../templates/1099-contractor.json";
import { BUILT_IN_TEMPLATES } from "../templates";
import {
  formatRate,
  incomeForSetAside,
  parseTemplate,
  parseTemplateJson,
  planTemplate,
  setAsideAmount,
  type Template,
} from "./templates";
import { INCOME, type Budget, type Category } from "./types";

let n = 0;
const ids = () => `new-${++n}`;
const cat = (group: string, name: string, extra: Partial<Category> = {}): Category => ({
  id: `${group}-${name}`,
  group,
  name,
  archived: false,
  ...extra,
});
const template = (categories: Template["categories"]): Template => ({
  format: "freewealthcare-template",
  version: 1,
  id: "t",
  name: "T",
  description: "",
  categories,
});

describe("built-in templates", () => {
  it("all pass validation", () => {
    expect(BUILT_IN_TEMPLATES.length).toBeGreaterThan(0);
  });

  it("the published download is identical to the bundled copy", () => {
    expect(JSON.parse(published)).toEqual(contractor);
  });

  it("the contractor template sets aside 25% for quarterly taxes", () => {
    const taxes = BUILT_IN_TEMPLATES[0]!.categories.find((c) => c.name === "Quarterly Estimated Taxes");
    expect(taxes?.setAsideRate).toBe(2500);
  });
});

describe("parseTemplate", () => {
  it("rejects bad JSON, other formats, empty and oversized category lists", () => {
    expect(parseTemplateJson("{")).toMatchObject({ ok: false, error: expect.stringMatching(/JSON/) });
    expect(parseTemplate({ ...contractor, format: "other" })).toMatchObject({ ok: false });
    expect(parseTemplate({ ...contractor, categories: [] })).toMatchObject({ ok: false });
    expect(
      parseTemplate({ ...contractor, categories: Array.from({ length: 201 }, (_, i) => ({ group: "G", name: `c${i}` })) }),
    ).toMatchObject({ ok: false });
  });

  it("rejects set-aside rates of 90% or more, fractions, and blank names", () => {
    const bad = (c: object) => parseTemplate({ ...contractor, categories: [{ group: "G", name: "N", ...c }] });
    expect(bad({ setAsideRate: 9001 })).toMatchObject({ ok: false });
    expect(bad({ setAsideRate: 12.5 })).toMatchObject({ ok: false });
    expect(bad({ name: "   " })).toMatchObject({ ok: false });
  });

  it("drops unknown fields", () => {
    const result = parseTemplate({ ...contractor, extra: "x", categories: [{ group: "G", name: "N", script: "<x>" }] });
    expect(result.ok && result.template.categories[0]).toEqual({ group: "G", name: "N" });
  });
});

describe("planTemplate", () => {
  it("adds missing categories with their set-aside rate", () => {
    const plan = planTemplate([], template([{ group: "Taxes", name: "Quarterly", setAsideRate: 2500 }]), ids);
    expect(plan.added).toEqual(["Quarterly"]);
    expect(plan.toPut[0]).toMatchObject({ group: "Taxes", name: "Quarterly", setAsideRate: 2500, archived: false });
  });

  it("matches existing categories ignoring case and spacing, so applying twice is a no-op", () => {
    const existing = [cat("Bills", "Utilities")];
    const plan = planTemplate(existing, template([{ group: " bills", name: "UTILITIES " }]), ids);
    expect(plan).toMatchObject({ toPut: [], added: [], updated: [], unchanged: 1 });
  });

  it("never overwrites a rate the user already chose", () => {
    const existing = [cat("Taxes", "Quarterly", { setAsideRate: 3000 })];
    const plan = planTemplate(existing, template([{ group: "Taxes", name: "Quarterly", setAsideRate: 2500 }]), ids);
    expect(plan.toPut).toEqual([]);
  });

  it("adds a rate to an existing category that has none", () => {
    const plan = planTemplate([cat("Taxes", "Quarterly")], template([{ group: "Taxes", name: "Quarterly", setAsideRate: 2500 }]), ids);
    expect(plan.updated).toEqual(["Quarterly"]);
    expect(plan.toPut[0]).toMatchObject({ id: "Taxes-Quarterly", setAsideRate: 2500 });
  });

  it("restores an archived match instead of duplicating it", () => {
    const plan = planTemplate([cat("Fun", "Gifts", { archived: true })], template([{ group: "Fun", name: "Gifts" }]), ids);
    expect(plan.toPut).toEqual([cat("Fun", "Gifts")]);
    expect(plan.added).toEqual([]);
  });

  it("ignores duplicates inside the template itself", () => {
    const plan = planTemplate([], template([{ group: "A", name: "B" }, { group: "a", name: "b" }]), ids);
    expect(plan.added).toHaveLength(1);
  });
});

describe("set-aside math", () => {
  const budget: Budget = {
    accounts: [],
    categories: [],
    assignments: [],
    transactions: [
      { id: "1", accountId: "a", date: "2026-10-03", payee: "Client A", memo: "", amount: 400000, categoryId: INCOME },
      { id: "2", accountId: "a", date: "2026-10-01", payee: "Starting balance", memo: "", amount: 900000, categoryId: INCOME, opening: true },
      { id: "3", accountId: "a", date: "2026-09-30", payee: "Client B", memo: "", amount: 100000, categoryId: INCOME },
      { id: "4", accountId: "a", date: "2026-10-05", payee: "Refund", memo: "", amount: 5000, categoryId: null },
      { id: "5", accountId: "a", date: "2026-10-09", payee: "Chargeback", memo: "", amount: -20000, categoryId: INCOME },
    ],
  };

  it("counts only this month's new income, not starting balances or other money in", () => {
    expect(incomeForSetAside(budget, "2026-10")).toBe(400000);
    expect(incomeForSetAside(budget, "2026-09")).toBe(100000);
  });

  it("rounds to the nearest cent", () => {
    expect(setAsideAmount(400000, 2500)).toBe(100000);
    expect(setAsideAmount(333, 2500)).toBe(83);
    expect(setAsideAmount(1, 5000)).toBe(1);
  });

  it("formats rates", () => {
    expect(formatRate(2500)).toBe("25%");
    expect(formatRate(1525)).toBe("15.25%");
  });
});
