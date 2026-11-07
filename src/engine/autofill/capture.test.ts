import { describe, it, expect, beforeEach } from "vitest";
import { captureCurrentForm } from "./capture";

describe("captureCurrentForm", () => {
  beforeEach(() => {
    (globalThis as any).location = {
      protocol: "https:",
      hostname: "sirup.inaproc.id",
      href: "https://sirup.inaproc.id/sirup/paket/form"
    };

    // Mock DOM elements
    const emptyInput = {
      tagName: "INPUT",
      getAttribute: (attr: string) => (attr === "name" ? "paket.kosong" : null),
      hasAttribute: (attr: string) => attr === "name",
      value: "   ",
      readOnly: false,
      disabled: false
    };

    const filledInput = {
      tagName: "INPUT",
      getAttribute: (attr: string) => (attr === "name" ? "paket.nama" : null),
      hasAttribute: (attr: string) => attr === "name",
      value: "Pengadaan Meja",
      readOnly: false,
      disabled: false
    };

    const readonlyInput = {
      tagName: "INPUT",
      getAttribute: (attr: string) => (attr === "name" ? "paket.satker" : null),
      hasAttribute: (attr: string) => attr === "name",
      value: "INSPEKTORAT",
      readOnly: true,
      disabled: false
    };

    (globalThis as any).document = {
      querySelectorAll: (sel: string) => {
        if (sel.includes("textarea")) {
          return [emptyInput, filledInput, readonlyInput];
        }
        if (sel.includes('input[type="radio"]:checked')) {
          return [];
        }
        if (sel.includes('input[type="checkbox"]:checked')) {
          return [];
        }
        if (sel.includes("select")) {
          return [];
        }
        return [];
      },
      forms: []
    };
  });

  it("strictly ignores empty inputs and readonly inputs, capturing only user-filled values", () => {
    const rules = captureCurrentForm("profile-1");
    expect(rules.length).toBe(1);
    expect(rules[0].matcher.pattern).toBe("paket.nama");
    expect(rules[0].value).toBe("Pengadaan Meja");
    expect(rules[0].site).toBe("sirup.inaproc.id");
  });
});
