import { loadData } from "../../storage/chrome-storage";
import { applyRule } from "../autofill/fill";

export function matchesSite(siteFilter?: string): boolean {
  if (!siteFilter || !siteFilter.trim()) return true;
  if (typeof location === "undefined") return true;
  const pattern = siteFilter.trim().toLowerCase();

  // 1. Check if user wrote a RegExp, e.g. /sirup/i
  if (pattern.startsWith("/") && pattern.lastIndexOf("/") > 0) {
    try {
      const lastSlash = pattern.lastIndexOf("/");
      const regex = new RegExp(pattern.slice(1, lastSlash), pattern.slice(lastSlash + 1));
      if (regex.test(location.href) || (typeof document !== "undefined" && regex.test(document.title))) {
        return true;
      }
    } catch {
      // Fall through to string matching
    }
  }

  // 2. Direct match against URL and Title (case-insensitive)
  const currentUrl = (location.href || "").toLowerCase();
  const origin = location.origin ? location.origin.toLowerCase() : "";
  const hostname = location.hostname ? location.hostname.toLowerCase() : "";
  const pathname = location.pathname ? location.pathname.toLowerCase() : "";
  const title = typeof document !== "undefined" && document.title ? document.title.toLowerCase() : "";

  if (
    currentUrl.includes(pattern) ||
    origin.includes(pattern) ||
    hostname.includes(pattern) ||
    pathname.includes(pattern) ||
    title.includes(pattern)
  ) {
    return true;
  }

  // 3. Saved offline file or localhost testing:
  // When testing a saved web page (file:// or localhost), match against form action and meta tags
  if (
    typeof document !== "undefined" &&
    (location.protocol === "file:" || hostname === "localhost" || hostname === "127.0.0.1")
  ) {
    // Check form actions (e.g. action="https://sirup.inaproc.id/...")
    const forms = Array.from(document.forms);
    for (const form of forms) {
      const action = (form.getAttribute("action") || "").toLowerCase();
      if (action.includes(pattern)) return true;
    }

    // Check baseURI
    if (document.baseURI && document.baseURI.toLowerCase().includes(pattern)) {
      return true;
    }

    // Check og:url or canonical links
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical?.href && canonical.href.toLowerCase().includes(pattern)) {
      return true;
    }
  }

  return false;
}

export async function runAutofill(profileId?: string) {
  const data = await loadData();
  const profiles = data.profiles.filter((p) => p.enabled && (!profileId || p.id === profileId));
  const ids = new Set(profiles.map((p) => p.id));
  const rules = data.rules
    .filter((r) => r.enabled && ids.has(r.profileId))
    .filter((r) => matchesSite(r.site))
    .sort((a, b) => a.order - b.order);

  // Apply ONLY the recorded rules for this page/profile.
  // Empty/unrecorded fields will NEVER be filled with fake/dummy data.
  return rules.map((rule) => ({ ruleId: rule.id, ...applyRule(rule) }));
}
