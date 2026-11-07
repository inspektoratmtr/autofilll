import type { AutofillRule } from "../../shared/types";
import { findTargets } from "../matching/matcher";

function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function updateSelect2IfPresent(select: HTMLSelectElement, selectedText: string) {
  // Select2 creates a sibling container or container within the same parent
  const parent = select.parentElement;
  if (!parent) return;

  const rendered = parent.querySelector<HTMLElement>(".select2-selection__rendered");
  if (rendered) {
    rendered.textContent = selectedText;
    rendered.setAttribute("title", selectedText);
  }
}

export function applyRule(rule: AutofillRule): { matched: number; filled: number; skipped: number } {
  let filled = 0;
  let skipped = 0;
  const targets = findTargets(rule);

  for (const target of targets) {
    if (rule.type === "javascript") continue; // Custom scripts are intentionally not evaluated in this MVP.

    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      if (target instanceof HTMLInputElement && target.type === "file") {
        skipped++;
        continue;
      }

      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        const truthy = ["1", "true", "yes", "ya", "checked", "on"];
        const next = truthy.includes(rule.value.trim().toLowerCase());
        if (rule.mode === "safe" && target.checked) {
          skipped++;
          continue;
        }
        target.checked = next;
        target.dispatchEvent(new Event("change", { bubbles: true }));
        target.dispatchEvent(new Event("input", { bubbles: true }));
        filled++;
      } else if (target instanceof HTMLInputElement && target.type === "radio") {
        const val = rule.value.trim().toLowerCase();
        const targetVal = target.value.trim().toLowerCase();
        const labelText = (target.closest("label")?.textContent || "").trim().toLowerCase();

        let shouldCheck = false;
        if (targetVal === val) {
          shouldCheck = true;
        } else if (["true", "1", "ya", "yes"].includes(val)) {
          shouldCheck = targetVal === "true" || targetVal === "1" || labelText.includes("ya") || labelText.includes("yes");
        } else if (["false", "0", "tidak", "no"].includes(val)) {
          shouldCheck = targetVal === "false" || targetVal === "0" || labelText.includes("tidak") || labelText.includes("no");
        } else if (labelText.includes(val)) {
          shouldCheck = true;
        }

        if (shouldCheck) {
          target.checked = true;
          target.dispatchEvent(new Event("change", { bubbles: true }));
          target.dispatchEvent(new Event("input", { bubbles: true }));
          filled++;
        }
      } else {
        if (rule.mode === "safe" && target.value.trim() !== "") {
          skipped++;
          continue;
        }
        setNativeValue(target, rule.value);
        filled++;
      }
    } else if (target instanceof HTMLSelectElement) {
      if (rule.mode === "safe" && target.value !== "") {
        skipped++;
        continue;
      }

      const val = rule.value.trim().toLowerCase();
      // 1. Match by option value
      let matchedOption = Array.from(target.options).find(
        (opt) => opt.value.trim().toLowerCase() === val
      );

      // 2. Match by option visible text / label
      if (!matchedOption) {
        matchedOption = Array.from(target.options).find((opt) => {
          const text = opt.text.trim().toLowerCase();
          return text === val || text.includes(val);
        });
      }

      if (matchedOption) {
        target.value = matchedOption.value;
        matchedOption.selected = true;
        updateSelect2IfPresent(target, matchedOption.text);
      } else {
        target.value = rule.value;
        updateSelect2IfPresent(target, rule.value);
      }

      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      filled++;
    } else if (target.isContentEditable) {
      if (rule.mode === "safe" && (target.textContent ?? "").trim() !== "") {
        skipped++;
        continue;
      }
      target.textContent = rule.value;
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: rule.value }));
      filled++;
    }
  }

  return { matched: targets.length, filled, skipped };
}
