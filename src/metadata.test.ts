import { describe, expect, it } from "vitest";
import html from "../index.html?raw";

const doc = new DOMParser().parseFromString(html, "text/html");

describe("public HTML shell", () => {
  it("includes useful search and social metadata without an invented origin", () => {
    expect(doc.title).toBe("FreeWealthCare | Private, Local-First Budgeting");
    for (const selector of [
      'meta[name="description"]', 'meta[property="og:title"]',
      'meta[property="og:description"]', 'meta[name="twitter:description"]',
    ]) {
      expect(doc.querySelector(selector)?.getAttribute("content")?.length).toBeGreaterThan(30);
    }
    expect(doc.querySelector('link[rel="canonical"]')).toBeNull();
    expect(doc.querySelector('meta[property="og:url"]')).toBeNull();
  });
  it("provides a truthful no-JavaScript introduction inside the replaceable root", () => {
    const root = doc.querySelector("#root");
    expect(root?.querySelectorAll("h1")).toHaveLength(1);
    expect(root?.textContent).toContain("Clearing browser data can erase your budget");
    expect(root?.querySelector("noscript")?.textContent).toContain("Enable JavaScript");
    expect(root?.textContent).toContain("not financial, tax,");
    expect(doc.querySelectorAll("iframe, form, img")).toHaveLength(0);
    expect(Array.from(doc.querySelectorAll("script")).map(s => s.getAttribute("src")))
      .toEqual(["/src/main.tsx"]);
  });
});
