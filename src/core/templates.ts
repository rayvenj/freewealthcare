import { z } from "zod";
import { monthOf } from "./dates";
import type { Cents } from "./money";
import { INCOME, type Budget, type Category, type Month } from "./types";

// A template is a starting set of categories someone can share: in a newsletter
// post, a forum, a group chat. Like a backup, it is untrusted input. Unlike a
// backup it can only ADD categories (and suggest a set-aside rate). It never
// touches transactions, balances or assigned money.

export const TEMPLATE_FORMAT = "freewealthcare-template";
export const TEMPLATE_VERSION = 1;
export const MAX_TEMPLATE_BYTES = 256 * 1024;

/** Set-aside rates are basis points: 2500 = 25%. Capped well below 100%. */
export const MAX_SET_ASIDE_RATE = 9000;

const label = z.string().trim().min(1).max(100);

const templateSchema = z.object({
  format: z.literal(TEMPLATE_FORMAT),
  version: z.literal(TEMPLATE_VERSION),
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000),
  author: z.string().max(100).optional(),
  source: z.string().url().max(300).optional(),
  categories: z
    .array(
      z.object({
        group: label,
        name: label,
        setAsideRate: z.number().int().min(1).max(MAX_SET_ASIDE_RATE).optional(),
      }),
    )
    .min(1)
    .max(200),
});

export type Template = z.infer<typeof templateSchema>;

export type ParseTemplateResult = { ok: true; template: Template } | { ok: false; error: string };

export function parseTemplate(raw: unknown): ParseTemplateResult {
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Not a valid FreeWealthCare template${issue ? ` (${issue.path.join(".") || "root"}: ${issue.message})` : ""}.`,
    };
  }
  return { ok: true, template: parsed.data };
}

export function parseTemplateJson(json: string): ParseTemplateResult {
  try {
    return parseTemplate(JSON.parse(json));
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
}

const keyOf = (group: string, name: string) => `${group.trim().toLowerCase()}|${name.trim().toLowerCase()}`;

export interface TemplatePlan {
  /** Categories to write: new ones plus existing ones that change. */
  toPut: Category[];
  added: string[];
  updated: string[];
  unchanged: number;
}

/**
 * Works out what applying a template would change, without changing anything.
 * Existing categories match on group + name, ignoring case, so applying a
 * template twice is a no-op. The user's own choices win: an existing set-aside
 * rate is never overwritten. An archived match is restored rather than duplicated.
 */
export function planTemplate(existing: Category[], template: Template, newId: () => string): TemplatePlan {
  const byKey = new Map(existing.map((c) => [keyOf(c.group, c.name), c]));
  const plan: TemplatePlan = { toPut: [], added: [], updated: [], unchanged: 0 };
  const seen = new Set<string>();

  for (const t of template.categories) {
    const key = keyOf(t.group, t.name);
    if (seen.has(key)) continue;
    seen.add(key);

    const match = byKey.get(key);
    if (!match) {
      const c: Category = { id: newId(), name: t.name, group: t.group, archived: false };
      if (t.setAsideRate) c.setAsideRate = t.setAsideRate;
      plan.toPut.push(c);
      plan.added.push(t.name);
      continue;
    }
    const next: Category = { ...match, archived: false };
    if (t.setAsideRate && match.setAsideRate === undefined) next.setAsideRate = t.setAsideRate;
    if (next.archived !== match.archived || next.setAsideRate !== match.setAsideRate) {
      plan.toPut.push(next);
      plan.updated.push(match.name);
    } else {
      plan.unchanged++;
    }
  }
  return plan;
}

/** Income received in a month that counts toward set-asides. Starting balances don't: that money was already yours. */
export function incomeForSetAside(budget: Budget, month: Month): Cents {
  let total = 0;
  for (const t of budget.transactions) {
    if (t.categoryId === INCOME && !t.opening && t.amount > 0 && monthOf(t.date) === month) total += t.amount;
  }
  return total;
}

/** Rounds to the nearest cent. */
export function setAsideAmount(income: Cents, rateBps: number): Cents {
  return Math.round((income * rateBps) / 10_000);
}

export function formatRate(rateBps: number): string {
  return `${(rateBps / 100).toFixed(rateBps % 100 === 0 ? 0 : 2)}%`;
}
