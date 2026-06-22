/**
 * utm-server.ts — server-side UTM attribution utilities.
 *
 * Pure functions: no I/O, no browser APIs. Safe to import in API routes,
 * server actions, and Route Handlers. Do NOT use lib/utm.ts browser
 * functions (captureUtmFromUrl, getStoredUtm, etc.) on the server.
 *
 * Exports:
 *   LeadAttributionData  — the full set of attribution columns on `leads`
 *   buildSourceLabel()   — human-readable label from UTM params
 *   extractUtmFromPayload() — extracts attribution data from any form body
 */

// ── Shared type ───────────────────────────────────────────────────────────────

/**
 * All attribution columns stored on the `leads` table.
 * Extends the original 5 UTM fields with landing_page, referrer, source_label.
 */
export type LeadAttributionData = {
  utm_source?:   string | null;
  utm_medium?:   string | null;
  utm_campaign?: string | null;
  utm_term?:     string | null;
  utm_content?:  string | null;
  landing_page?: string | null;
  referrer?:     string | null;
  source_label?: string | null;
};

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Converts a URL slug / param value into readable title-case words.
 * Handles hyphens, underscores, and letter-digit boundaries.
 *
 * Examples:
 *   "summer2026"          → "Summer 2026"
 *   "google-ads"          → "Google Ads"
 *   "facebook_retargeting"→ "Facebook Retargeting"
 *   "brand_search_2026"   → "Brand Search 2026"
 */
function slugToWords(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")                   // hyphens / underscores → spaces
    .replace(/([a-z])([0-9])/gi, "$1 $2")    // "summer2026"  → "summer 2026"
    .replace(/([0-9])([a-z])/gi, "$1 $2")    // "2026summer"  → "2026 summer"
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Medium values that are better displayed as uppercase abbreviations
 * rather than title-cased words (e.g. "cpc" → "CPC" not "Cpc").
 */
const UPPERCASE_MEDIUMS: Record<string, string> = {
  cpc: "CPC",
  ppc: "PPC",
  cpm: "CPM",
  cpa: "CPA",
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Builds a human-readable source label from UTM parameters.
 * Returns null when utm_source is absent (nothing meaningful to show).
 *
 * Format: "{Source} [ / {Medium}] [ - {Campaign}]"
 *
 * Examples:
 *   ("instagram", null, "summer2026")    → "Instagram - Summer 2026"
 *   ("google", "cpc", "brand_search")    → "Google / CPC - Brand Search"
 *   ("facebook", "social", null)         → "Facebook / Social"
 *   ("instagram", null, null)            → "Instagram"
 */
export function buildSourceLabel(
  utm_source?:   string | null,
  utm_medium?:   string | null,
  utm_campaign?: string | null,
): string | null {
  if (!utm_source) return null;

  const source   = slugToWords(utm_source);
  const medium   = utm_medium
    ? (UPPERCASE_MEDIUMS[utm_medium.toLowerCase()] ?? slugToWords(utm_medium))
    : null;
  const campaign = utm_campaign ? slugToWords(utm_campaign) : null;

  // "Instagram" or "Google / CPC"
  const base = medium ? `${source} / ${medium}` : source;
  // Append campaign if present
  return campaign ? `${base} - ${campaign}` : base;
}

/**
 * Extracts UTM and attribution fields from an arbitrary form payload object.
 *
 * Checks standard snake_case names first, then common camelCase and
 * human-friendly variants so it works out-of-the-box with:
 *   - Webflow forms     (utm_source, landing_page, etc.)
 *   - Typeform          (UTM Source, Landing Page, etc.)
 *   - Custom HTML forms (utmSource, landingPage, etc.)
 *
 * Automatically generates source_label unless the caller already supplied one.
 *
 * @param body - Raw parsed JSON body from the incoming request.
 */
export function extractUtmFromPayload(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>,
): LeadAttributionData {
  /**
   * Picks the first non-empty string value from a list of candidate keys,
   * also trying hyphenated and space-separated variants automatically.
   */
  function pick(...keys: string[]): string | null {
    for (const key of keys) {
      const candidates = [
        key,
        key.replace(/_/g, "-"),   // utm_source  → utm-source
        key.replace(/_/g, " "),   // utm_source  → utm source
      ];
      for (const k of candidates) {
        const val = body[k];
        if (val && typeof val === "string" && val.trim()) return val.trim();
      }
    }
    return null;
  }

  const utm_source   = pick("utm_source",   "UTM Source",   "utmSource");
  const utm_medium   = pick("utm_medium",   "UTM Medium",   "utmMedium");
  const utm_campaign = pick("utm_campaign", "UTM Campaign", "utmCampaign");
  const utm_term     = pick("utm_term",     "UTM Term",     "utmTerm");
  const utm_content  = pick("utm_content",  "UTM Content",  "utmContent");
  const landing_page = pick("landing_page", "Landing Page", "landingPage", "page_url", "pageUrl");
  const referrer     = pick("referrer",     "Referrer",     "ref_url",     "refUrl",   "referrer_url");

  // Build source_label from UTM data, or use whatever was passed in directly.
  const source_label =
    pick("source_label", "Source Label", "sourceLabel") ??
    buildSourceLabel(utm_source, utm_medium, utm_campaign);

  return {
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    landing_page,
    referrer,
    source_label,
  };
}
