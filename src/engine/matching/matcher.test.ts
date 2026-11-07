import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { findTargets } from "./matcher";
import { applyRule } from "../autofill/fill";
import type { AutofillRule } from "../../shared/types";

describe("matcher and fill with simulated DOM elements", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = {
      querySelectorAll: (sel: string) => []
    } as any;
  });

  it("handles selector with dots in ID safely without crashing", () => {
    const rule: AutofillRule = {
      id: "1",
      profileId: "default",
      type: "text",
      matcher: { selector: "#paket.nama" },
      value: "Paket Pengadaan ATK",
      mode: "overwrite",
      enabled: true,
      order: 0
    };

    const targets = findTargets(rule, container);
    expect(targets).toEqual([]);
  });
});
