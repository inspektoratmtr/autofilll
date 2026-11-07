import type { AutofillRule } from "../../shared/types";
import { DEFAULT_PROFILE_ID } from "../../shared/constants";

function getSitePattern(): string {
  if (typeof location === "undefined") return "";
  if (location.protocol === "http:" || location.protocol === "https:") {
    return location.hostname;
  }
  return "";
}

/**
 * Generate rules from the current page's form fields (similar to Lightning Autofill).
 * Only captures fields that are filled with actual values. Empty fields are ignored.
 */
export function captureCurrentForm(profileId: string = DEFAULT_PROFILE_ID): AutofillRule[] {
  const rules: AutofillRule[] = [];
  const seenNames = new Set<string>();
  const site = getSitePattern();

  // 1. Text Inputs and Textareas
  const textInputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="radio"]):not([type="checkbox"]):not([type="file"]), textarea'
    )
  );

  for (const el of textInputs) {
    if (el.readOnly || el.disabled) continue;

    const val = (el.value || "").trim();
    if (!val) continue;

    const name = el.getAttribute("name") || el.getAttribute("id");
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);

    rules.push({
      id: crypto.randomUUID(),
      profileId,
      type: "text",
      matcher: {
        attribute: el.hasAttribute("name") ? "name" : "id",
        pattern: name,
        matchMode: "exact"
      },
      value: val,
      site: site || undefined,
      mode: "overwrite",
      enabled: true,
      order: rules.length
    });
  }

  // 2. Radio Buttons (Checked only)
  const checkedRadios = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked:not([disabled])')
  );
  for (const radio of checkedRadios) {
    const name = radio.getAttribute("name") || radio.getAttribute("id");
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);

    const val = radio.value || "true";

    rules.push({
      id: crypto.randomUUID(),
      profileId,
      type: "radio",
      matcher: {
        attribute: radio.hasAttribute("name") ? "name" : "id",
        pattern: name,
        matchMode: "exact"
      },
      value: val,
      site: site || undefined,
      mode: "overwrite",
      enabled: true,
      order: rules.length
    });
  }

  // 3. Checkboxes (Checked only)
  const checkedBoxes = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked:not([disabled])')
  );
  for (const box of checkedBoxes) {
    const name = box.getAttribute("name") || box.getAttribute("id");
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);

    rules.push({
      id: crypto.randomUUID(),
      profileId,
      type: "checkbox",
      matcher: {
        attribute: box.hasAttribute("name") ? "name" : "id",
        pattern: name,
        matchMode: "exact"
      },
      value: "true",
      site: site || undefined,
      mode: "overwrite",
      enabled: true,
      order: rules.length
    });
  }

  // 4. Dropdowns (<select>)
  const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select:not([disabled])"));
  for (const select of selects) {
    if (select.selectedIndex < 0) continue;
    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption) continue;

    const optVal = (selectedOption.value || "").trim();
    const optText = (selectedOption.text || "").trim();

    // Ignore placeholder / empty options
    if (!optVal && !optText) continue;
    if (optText.toLowerCase().includes("---pilih---") || optText.toLowerCase().includes("--pilih--")) continue;

    const name = select.getAttribute("name") || select.getAttribute("id");
    if (!name || seenNames.has(name)) continue;
    seenNames.add(name);

    // Prefer value, fallback to text
    const finalVal = optVal ? optVal : optText;

    rules.push({
      id: crypto.randomUUID(),
      profileId,
      type: "select",
      matcher: {
        attribute: select.hasAttribute("name") ? "name" : "id",
        pattern: name,
        matchMode: "exact"
      },
      value: finalVal,
      site: site || undefined,
      mode: "overwrite",
      enabled: true,
      order: rules.length
    });
  }

  return rules;
}
