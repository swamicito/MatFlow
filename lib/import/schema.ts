import type { BeltRank, StudentStatus } from "@/lib/supabase/types";

/**
 * Logical fields the importer can target. Each row in the uploaded CSV is
 * mapped to a subset of these fields. Required fields must be mapped (or
 * derivable, e.g. full_name from first+last).
 */
export type FieldKey =
  | "ignore"
  | "full_name"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "date_of_birth"
  | "join_date"
  | "belt_rank"
  | "stripes"
  | "status"
  | "notes"
  | "membership_plan"
  | "membership_price"
  | "custom_price"
  | "membership_status"
  | "renewal_date"
  | "attendance_count";

export type FieldDef = {
  key: FieldKey;
  label: string;
  group: "core" | "belt" | "membership" | "meta";
  /** True if the importer can succeed without it. */
  optional: boolean;
  hint?: string;
};

export const FIELDS: FieldDef[] = [
  { key: "ignore", label: "— Don't import —", group: "meta", optional: true },
  { key: "full_name", label: "Full Name", group: "core", optional: false, hint: "Or use First Name + Last Name." },
  { key: "first_name", label: "First Name", group: "core", optional: true },
  { key: "last_name", label: "Last Name", group: "core", optional: true },
  { key: "email", label: "Email", group: "core", optional: true },
  { key: "phone", label: "Phone", group: "core", optional: true },
  { key: "date_of_birth", label: "Date of Birth", group: "core", optional: true },
  { key: "join_date", label: "Join Date", group: "core", optional: true },
  { key: "status", label: "Status", group: "core", optional: true, hint: "active / trial / paused / cancelled" },
  { key: "belt_rank", label: "Belt Rank", group: "belt", optional: true },
  { key: "stripes", label: "Stripes", group: "belt", optional: true },
  { key: "membership_plan", label: "Membership / Plan Name", group: "membership", optional: true },
  { key: "membership_price", label: "Membership Price", group: "membership", optional: true, hint: "USD; auto-converted to cents." },
  { key: "custom_price", label: "Grandfathered Price", group: "membership", optional: true, hint: "Per-student override." },
  { key: "membership_status", label: "Membership Status", group: "membership", optional: true },
  { key: "renewal_date", label: "Renewal / Expiration Date", group: "membership", optional: true, hint: "When the current membership expires or renews." },
  { key: "attendance_count", label: "Total Attendance / Visits", group: "meta", optional: true, hint: "Lifetime check-in count — seeds streaks and badges." },
  { key: "notes", label: "Notes", group: "meta", optional: true },
];

export const FIELD_BY_KEY: Record<FieldKey, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.key, f]),
) as Record<FieldKey, FieldDef>;

/**
 * Common Mindbody / generic gym-CRM column names → our FieldKey. Matching is
 * case- and whitespace-insensitive.
 */
const HEURISTICS: Array<{ patterns: RegExp[]; field: FieldKey }> = [
  { field: "first_name", patterns: [/^first[\s_]?name$/i, /^given[\s_]?name$/i, /^fname$/i] },
  { field: "last_name", patterns: [/^last[\s_]?name$/i, /^family[\s_]?name$/i, /^surname$/i, /^lname$/i] },
  { field: "full_name", patterns: [/^full[\s_]?name$/i, /^client[\s_]?name$/i, /^name$/i, /^student[\s_]?name$/i] },
  { field: "email", patterns: [/^e?[\s_-]?mail([\s_]?address)?$/i, /^client[\s_]?email$/i] },
  { field: "phone", patterns: [/^phone([\s_]?(number|#|no))?$/i, /^mobile$/i, /^cell$/i, /^contact[\s_]?number$/i] },
  { field: "date_of_birth", patterns: [/^d[\s_-]?o[\s_-]?b$/i, /^date[\s_]?of[\s_]?birth$/i, /^birth[\s_]?date$/i, /^birthday$/i] },
  { field: "join_date", patterns: [/^join[\s_]?date$/i, /^start[\s_]?date$/i, /^member[\s_]?since$/i, /^enrollment[\s_]?date$/i, /^signup[\s_]?date$/i] },
  { field: "status", patterns: [/^status$/i, /^client[\s_]?status$/i, /^member[\s_]?status$/i, /^active$/i] },
  { field: "belt_rank", patterns: [/^belt([\s_]?(rank|level|color))?$/i, /^rank$/i] },
  { field: "stripes", patterns: [/^stripes?$/i, /^belt[\s_]?stripes?$/i] },
  { field: "membership_plan", patterns: [/^membership([\s_]?(name|type|plan))?$/i, /^plan$/i, /^pricing[\s_]?option$/i, /^contract$/i, /^package$/i] },
  { field: "membership_price", patterns: [/^price$/i, /^amount$/i, /^membership[\s_]?(price|amount|cost)$/i, /^plan[\s_]?price$/i, /^monthly[\s_]?price$/i, /^rate$/i] },
  { field: "custom_price", patterns: [/^custom[\s_]?(price|rate|amount)$/i, /^grandfathered([\s_]?price)?$/i, /^special[\s_]?(price|rate)$/i] },
  { field: "membership_status", patterns: [/^membership[\s_]?status$/i, /^subscription[\s_]?status$/i] },
  { field: "renewal_date", patterns: [/^renewal[\s_]?date$/i, /^expir(ation|y)?[\s_]?date$/i, /^next[\s_]?billing[\s_]?date$/i, /^next[\s_]?payment[\s_]?date$/i, /^contract[\s_]?end$/i, /^membership[\s_]?expir/i] },
  { field: "attendance_count", patterns: [/^attendance([\s_]?count)?$/i, /^(total[\s_]?)?visits?$/i, /^check[\s_]?in(s|[\s_]?count)?$/i, /^classes[\s_]?attended$/i, /^sessions?$/i] },
  { field: "notes", patterns: [/^notes?$/i, /^comments?$/i, /^remarks?$/i, /^internal[\s_]?notes?$/i] },
];

export function autoMapField(header: string): FieldKey {
  const h = header.trim();
  for (const rule of HEURISTICS) {
    if (rule.patterns.some((p) => p.test(h))) return rule.field;
  }
  return "ignore";
}

// ─────────────────── Value coercion helpers ───────────────────

/** Returns true if a string looks like a phone, email, etc. is "present". */
export function nz(s: string | undefined | null): string | null {
  if (s === null || s === undefined) return null;
  const t = s.trim();
  return t.length === 0 ? null : t;
}

/** "5/4/2023", "2023-05-04", "May 4, 2023" → "2023-05-04" or null. */
export function coerceDate(input: string | null | undefined): string | null {
  const v = nz(input);
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  // Normalize to YYYY-MM-DD (date-only).
  return d.toISOString().slice(0, 10);
}

/** "$129.00" / "129" / "129.00 USD" → 12900 (cents) or null. */
export function coerceCents(input: string | null | undefined): number | null {
  const v = nz(input);
  if (!v) return null;
  const cleaned = v.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 100);
}

const BELT_ALIASES: Record<string, BeltRank> = {
  white: "white",
  gray: "gray",
  grey: "gray",
  yellow: "yellow",
  orange: "orange",
  green: "green",
  blue: "blue",
  purple: "purple",
  brown: "brown",
  black: "black",
};

export function coerceBelt(input: string | null | undefined): BeltRank {
  const v = nz(input)?.toLowerCase() ?? "";
  // Strip "belt", stripe count, etc.
  const stripped = v.replace(/belt|\d|stripe|s\b/gi, "").trim();
  return BELT_ALIASES[stripped] ?? "white";
}

export function coerceStripes(input: string | null | undefined): number {
  const v = nz(input);
  if (!v) return 0;
  // First number we find; clamp to [0, 4].
  const m = v.match(/\d+/);
  if (!m) return 0;
  const n = Math.max(0, Math.min(4, Number.parseInt(m[0], 10) || 0));
  return n;
}

const STATUS_ALIASES: Record<string, StudentStatus> = {
  active: "active",
  current: "active",
  enrolled: "active",
  member: "active",
  trial: "trial",
  trialing: "trial",
  prospect: "trial",
  paused: "paused",
  suspended: "paused",
  hold: "paused",
  on_hold: "paused",
  frozen: "paused",
  cancelled: "cancelled",
  canceled: "cancelled",
  inactive: "cancelled",
  former: "cancelled",
  expired: "cancelled",
  terminated: "cancelled",
};

export function coerceStatus(input: string | null | undefined): StudentStatus {
  const v = nz(input)?.toLowerCase().replace(/[\s_-]+/g, "_") ?? "";
  return STATUS_ALIASES[v] ?? "active";
}
