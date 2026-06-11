import type {
  BeltRank,
  MembershipInterval,
  MembershipStatus,
  StudentStatus,
} from "@/lib/supabase/types";
import { isRevenueStatus, toMonthlyCents } from "@/lib/billing";

export type RangeKey = "30d" | "90d" | "all";

export const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export const RANGE_LABEL: Record<RangeKey, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export function rangeDays(r: RangeKey): number | null {
  return r === "30d" ? 30 : r === "90d" ? 90 : null;
}

/** ISO timestamp `n` days before `now` (UTC). */
export function isoDaysBefore(n: number, now: Date = new Date()): string {
  const d = new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

// ─────────────────── Inputs (all rows you fetch upstream) ───────────────────

export type StudentRow = {
  id: string;
  full_name: string;
  belt_rank: BeltRank;
  status: StudentStatus;
  join_date: string;
};

export type AttendanceRow = {
  student_id: string;
  checked_in_at: string;
};

export type MembershipRow = {
  id: string;
  student_id: string;
  plan_id: string;
  status: MembershipStatus;
  custom_price_cents: number | null;
};

export type PlanRow = {
  id: string;
  name: string;
  price_cents: number;
  interval: MembershipInterval;
};

export type LeadRow = {
  source: string | null;
  status: string;
};

export type BeltProgressRow = {
  student_id: string;
  current_belt: BeltRank;
  stripes: number;
};

// ─────────────────── Stats ───────────────────

/**
 * Retention rate over a window: of all students who were "active" at the
 * start of the window (joined before window-start), what fraction are still
 * not cancelled today?
 *
 * For a fresh demo with no churn data this returns 100% — that's accurate.
 */
export function retentionRate(
  students: StudentRow[],
  windowDays: number,
): { rate: number; cohort: number; retained: number } {
  const cutoff = new Date(Date.now() - windowDays * 86_400_000);
  const cohort = students.filter((s) => new Date(s.join_date) <= cutoff);
  if (cohort.length === 0) return { rate: 1, cohort: 0, retained: 0 };
  const retained = cohort.filter((s) => s.status !== "cancelled").length;
  return { rate: retained / cohort.length, cohort: cohort.length, retained };
}

/**
 * "At-risk": active or trialing students whose most recent check-in is older
 * than `thresholdDays`, OR who have never checked in but joined more than
 * `thresholdDays` ago.
 */
export type AtRiskRow = {
  id: string;
  full_name: string;
  belt_rank: BeltRank;
  status: StudentStatus;
  last_check_in: string | null;
  days_since: number | null;
};

export function atRiskStudents(
  students: StudentRow[],
  attendance: AttendanceRow[],
  thresholdDays: number,
): AtRiskRow[] {
  const lastById = new Map<string, string>();
  for (const a of attendance) {
    const prev = lastById.get(a.student_id);
    if (!prev || a.checked_in_at > prev) {
      lastById.set(a.student_id, a.checked_in_at);
    }
  }

  const now = Date.now();
  const out: AtRiskRow[] = [];
  for (const s of students) {
    if (s.status !== "active" && s.status !== "trial") continue;
    const last = lastById.get(s.id) ?? null;
    let days: number | null;
    if (last) {
      days = Math.floor((now - new Date(last).getTime()) / 86_400_000);
    } else {
      const joined = new Date(s.join_date).getTime();
      days = Math.floor((now - joined) / 86_400_000);
    }
    if (days !== null && days >= thresholdDays) {
      out.push({
        id: s.id,
        full_name: s.full_name,
        belt_rank: s.belt_rank,
        status: s.status,
        last_check_in: last,
        days_since: days,
      });
    }
  }
  return out.sort((a, b) => (b.days_since ?? 0) - (a.days_since ?? 0));
}

/**
 * Average classes attended per active student over the last `windowDays`.
 */
export function avgAttendance(
  students: StudentRow[],
  attendance: AttendanceRow[],
  windowDays: number,
): { avg: number; total: number; activeStudents: number } {
  const cutoff = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const recent = attendance.filter((a) => a.checked_in_at >= cutoff);
  const activeStudents = students.filter(
    (s) => s.status === "active" || s.status === "trial",
  ).length;
  if (activeStudents === 0) {
    return { avg: 0, total: recent.length, activeStudents: 0 };
  }
  return {
    avg: recent.length / activeStudents,
    total: recent.length,
    activeStudents,
  };
}

/**
 * Total monthly recurring revenue (in cents) across all "earning" memberships.
 */
export function mrrCents(
  memberships: MembershipRow[],
  plans: PlanRow[],
): number {
  const planById = new Map(plans.map((p) => [p.id, p] as const));
  return memberships
    .filter((m) => isRevenueStatus(m.status))
    .reduce((acc, m) => {
      const plan = planById.get(m.plan_id);
      if (!plan) return acc;
      const cents = m.custom_price_cents ?? plan.price_cents;
      return acc + toMonthlyCents(cents, plan.interval);
    }, 0);
}

// ─────────────────── Distributions ───────────────────

export type BeltBucket = {
  belt: BeltRank;
  count: number;
  pct: number;
  /** Stripe count → number of students at that stripe count. */
  stripes: Partial<Record<0 | 1 | 2 | 3 | 4, number>>;
};

const ADULT_BELT_ORDER: BeltRank[] = [
  "white",
  "blue",
  "purple",
  "brown",
  "black",
];
const KID_BELT_ORDER: BeltRank[] = ["gray", "yellow", "orange", "green"];

export function beltDistribution(
  students: StudentRow[],
  belts: BeltProgressRow[],
): BeltBucket[] {
  // Prefer belt_progress.current_belt + stripes when available; fall back to
  // students.belt_rank (with stripes = 0).
  const beltById = new Map(belts.map((b) => [b.student_id, b] as const));

  const buckets = new Map<BeltRank, BeltBucket>();
  const allBelts = [...ADULT_BELT_ORDER, ...KID_BELT_ORDER];
  for (const b of allBelts) {
    buckets.set(b, { belt: b, count: 0, pct: 0, stripes: {} });
  }

  for (const s of students) {
    const bp = beltById.get(s.id);
    const belt = (bp?.current_belt ?? s.belt_rank) as BeltRank;
    const stripes = (bp?.stripes ?? 0) as 0 | 1 | 2 | 3 | 4;
    const bucket = buckets.get(belt) ?? {
      belt,
      count: 0,
      pct: 0,
      stripes: {},
    };
    bucket.count += 1;
    bucket.stripes[stripes] = (bucket.stripes[stripes] ?? 0) + 1;
    buckets.set(belt, bucket);
  }

  const total = students.length || 1;
  // Order: adult belts first (most relevant), then kids belts; drop empty
  // buckets at the bottom.
  const ordered: BeltBucket[] = [...ADULT_BELT_ORDER, ...KID_BELT_ORDER]
    .map((b) => buckets.get(b)!)
    .map((b) => ({ ...b, pct: b.count / total }));
  return ordered;
}

// ─────────────────── Lead source performance ───────────────────

export type LeadSourceBucket = {
  source: string;
  total: number;
  converted: number;
  conversion: number; // 0..1
};

export function leadSourcePerformance(leads: LeadRow[]): LeadSourceBucket[] {
  const map = new Map<string, { total: number; converted: number }>();
  for (const l of leads) {
    const src = l.source?.trim() || "Unknown";
    const cur = map.get(src) ?? { total: 0, converted: 0 };
    cur.total += 1;
    if (l.status === "converted") cur.converted += 1;
    map.set(src, cur);
  }
  return Array.from(map.entries())
    .map(([source, v]) => ({
      source,
      total: v.total,
      converted: v.converted,
      conversion: v.total === 0 ? 0 : v.converted / v.total,
    }))
    .sort((a, b) => b.total - a.total);
}

// ─────────────────── Revenue by plan ───────────────────

export type RevenuePlanBucket = {
  plan_id: string;
  plan_name: string;
  members: number;
  monthly_cents: number;
};

export function revenueByPlan(
  memberships: MembershipRow[],
  plans: PlanRow[],
): RevenuePlanBucket[] {
  const planById = new Map(plans.map((p) => [p.id, p] as const));
  const buckets = new Map<string, RevenuePlanBucket>();
  for (const p of plans) {
    buckets.set(p.id, {
      plan_id: p.id,
      plan_name: p.name,
      members: 0,
      monthly_cents: 0,
    });
  }
  for (const m of memberships) {
    if (!isRevenueStatus(m.status)) continue;
    const plan = planById.get(m.plan_id);
    if (!plan) continue;
    const bucket = buckets.get(plan.id)!;
    const cents = m.custom_price_cents ?? plan.price_cents;
    bucket.members += 1;
    bucket.monthly_cents += toMonthlyCents(cents, plan.interval);
  }
  return Array.from(buckets.values())
    .filter((b) => b.members > 0)
    .sort((a, b) => b.monthly_cents - a.monthly_cents);
}
