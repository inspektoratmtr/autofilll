import type { AutofillRule } from "../../shared/types";

function matchesPattern(actual: string, pattern: string, mode: "partial" | "exact" | "regex" = "partial"): boolean {
  const a = (actual || "").trim().toLowerCase();
  const p = (pattern || "").trim().toLowerCase();
  if (!a || !p) return false;

  if (mode === "exact") return a === p;
  if (mode === "regex") {
    try {
      return new RegExp(pattern, "i").test(actual);
    } catch {
      return false;
    }
  }
  return a.includes(p);
}

function findElementsByLabel(
  pattern: string,
  mode: "partial" | "exact" | "regex" = "partial",
  root: ParentNode = document
): HTMLElement[] {
  const results = new Set<HTMLElement>();
  const labels = Array.from(root.querySelectorAll<HTMLLabelElement>("label"));

  for (const label of labels) {
    const text = (label.textContent || "").trim();
    if (!matchesPattern(text, pattern, mode)) continue;

    // 1. Label with htmlFor / for attribute
    const forId = label.htmlFor || label.getAttribute("for");
    if (forId) {
      try {
        const el = root.querySelector(`[id="${CSS.escape(forId)}"]`) as HTMLElement;
        if (el) results.add(el);
      } catch {}
    }

    // 2. Nested input inside label (e.g. <label><input ...> Label Text</label>)
    const nested = label.querySelector<HTMLElement>("input, select, textarea");
    if (nested) results.add(nested);

    // 3. Elements within the same form group or row
    const container = label.closest(".form-group, .form-row, tr, td, .col-sm-10, .col-sm-2");
    const parentContainer = container?.parentElement;
    const searchScope = parentContainer || container;
    if (searchScope) {
      const inputs = Array.from(
        searchScope.querySelectorAll<HTMLElement>("input:not([type=hidden]), select, textarea")
      );
      for (const input of inputs) {
        results.add(input);
      }
    }
  }

  return Array.from(results);
}

export function findTargets(rule: AutofillRule, root: ParentNode = document): HTMLElement[] {
  // 1. Explicit CSS selector
  if (rule.matcher.selector) {
    const sel = rule.matcher.selector;
    try {
      return Array.from(root.querySelectorAll<HTMLElement>(sel));
    } catch {
      try {
        const escaped = sel.replace(/#([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_.-]+)/g, (_, a, b) => `[id="${a}.${b}"]`);
        return Array.from(root.querySelectorAll<HTMLElement>(escaped));
      } catch {
        return [];
      }
    }
  }

  const attr = rule.matcher.attribute;
  const pattern = rule.matcher.pattern;
  if (!attr || !pattern) return [];

  // 2. Matching by visible text label
  if (attr === "label") {
    return findElementsByLabel(pattern, rule.matcher.matchMode, root);
  }

  // 3. Matching by HTML attribute (name, id, placeholder, class, aria-label, autocomplete)
  const targets = Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).filter((el) =>
    matchesPattern(el.getAttribute(attr) ?? "", pattern, rule.matcher.matchMode)
  );
  if (targets.length > 0) return targets;

  // 4. Fallback: if searching by name found nothing, check id
  if (attr === "name") {
    const idTargets = Array.from(root.querySelectorAll<HTMLElement>("[id]")).filter((el) =>
      matchesPattern(el.getAttribute("id") ?? "", pattern, rule.matcher.matchMode)
    );
    if (idTargets.length > 0) return idTargets;
  }

  // 5. Fallback: if searching by id found nothing, check name
  if (attr === "id") {
    const nameTargets = Array.from(root.querySelectorAll<HTMLElement>("[name]")).filter((el) =>
      matchesPattern(el.getAttribute("name") ?? "", pattern, rule.matcher.matchMode)
    );
    if (nameTargets.length > 0) return nameTargets;
  }

  // 6. Fallback: check label text
  const labelMatches = findElementsByLabel(pattern, rule.matcher.matchMode, root);
  if (labelMatches.length > 0) return labelMatches;

  return [];
}
