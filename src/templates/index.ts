import contractor from "./1099-contractor.json";
import { parseTemplate, type Template } from "../core/templates";

// Built-in templates ship inside the app bundle (the CSP blocks fetching them)
// and still go through the same validation as a file someone downloads.
function load(raw: unknown): Template {
  const result = parseTemplate(raw);
  if (!result.ok) throw new Error(`Built-in template is invalid: ${result.error}`);
  return result.template;
}

export const BUILT_IN_TEMPLATES: Template[] = [load(contractor)];
