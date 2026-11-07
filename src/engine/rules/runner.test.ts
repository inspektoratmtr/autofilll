import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { matchesSite } from "./runner";

describe("matchesSite", () => {
  const originalLocation = globalThis.location;
  const originalDocument = globalThis.document;

  beforeEach(() => {
    (globalThis as any).location = {
      href: "file:///Users/asnawi/Projects/mataram-autofill/RUP%20-%20Formulir%20Paket%20Penyedia.html",
      origin: "null",
      hostname: "",
      pathname: "/Users/asnawi/Projects/mataram-autofill/RUP - Formulir Paket Penyedia.html",
      protocol: "file:"
    };
    (globalThis as any).document = {
      title: "RUP - Formulir Paket Penyedia",
      forms: [
        {
          getAttribute: (attr: string) =>
            attr === "action"
              ? "https://sirup.inaproc.id/sirup/konsolidasictr/simpanpaketkonsolidasi"
              : null
        }
      ],
      baseURI: "https://sirup.inaproc.id",
      querySelector: () => null
    };
  });

  afterEach(() => {
    (globalThis as any).location = originalLocation;
    (globalThis as any).document = originalDocument;
  });

  it("returns true when site filter is empty or null", () => {
    expect(matchesSite("")).toBe(true);
    expect(matchesSite(undefined)).toBe(true);
    expect(matchesSite("   ")).toBe(true);
  });

  it("matches site filter case-insensitively with title", () => {
    expect(matchesSite("rup")).toBe(true);
    expect(matchesSite("RUP")).toBe(true);
    expect(matchesSite("Paket Penyedia")).toBe(true);
  });

  it("matches form action when running on local file:// or localhost", () => {
    expect(matchesSite("sirup.inaproc.id")).toBe(true);
    expect(matchesSite("sirup")).toBe(true);
    expect(matchesSite("inaproc")).toBe(true);
  });

  it("returns false for completely unrelated sites", () => {
    expect(matchesSite("facebook.com")).toBe(false);
    expect(matchesSite("google.com")).toBe(false);
  });
});
