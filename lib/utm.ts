/**
 * UTM parameter capture utility.
 *
 * Client usage:
 *   captureUtmFromUrl()  — call once on mount to persist URL params
 *   getStoredUtm()       — read before form submission
 *   clearStoredUtm()     — call after the data has been saved to the DB
 *
 * Server / shared usage:
 *   UtmParams            — type used in server action inputs
 */

const STORAGE_KEY = "mf_utm";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Shared type (safe to import in server actions) ─────────────────────────

export type UtmParams = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
};

type StoredEntry = UtmParams & { source?: string; expires_at: number };

// ── Browser utilities ──────────────────────────────────────────────────────

/**
 * Reads UTM parameters from the current URL and writes them to localStorage.
 * Safe to call on every page load — no-ops if no UTM params are present.
 * Must only be called client-side (guarded internally).
 */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const keys: (keyof UtmParams)[] = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ];

  const entry: Partial<StoredEntry> = {};
  let found = false;

  for (const key of keys) {
    const val = params.get(key);
    if (val) {
      entry[key] = val;
      found = true;
    }
  }

  if (!found) return;

  if (entry.utm_source) {
    entry.source = entry.utm_source;
  }

  entry.expires_at = Date.now() + TTL_MS;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage unavailable (private mode, storage quota) — fail silently.
  }
}

/**
 * Returns the stored UTM data if it exists and has not expired.
 * Returns null otherwise.
 */
export function getStoredUtm(): (UtmParams & { source?: string }) | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const entry: StoredEntry = JSON.parse(raw);
    if (entry.expires_at < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    const { expires_at, ...data } = entry;
    void expires_at;
    return data;
  } catch {
    return null;
  }
}

/**
 * Clears stored UTM data.
 * Call this immediately after the UTM data has been saved to the database.
 */
export function clearStoredUtm(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // fail silently
  }
}
