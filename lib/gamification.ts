/**
 * Gamification: weekly goals, streaks, attendance heat map, badge catalog.
 *
 * All date math uses ISO calendar weeks starting on Monday so streaks line up
 * with how most BJJ students think of a "training week".
 */

import type { BeltRank } from "@/lib/supabase/types";
import { BELT_LABEL } from "@/lib/students";

// ─────────────────────────────────────────────────────────────────────────────
// Date helpers (Monday-start weeks, all in UTC for stability across timezones)
// ─────────────────────────────────────────────────────────────────────────────

/** Truncate a date to the Monday 00:00 UTC of its week. */
export function startOfWeek(d: Date): Date {
  const c = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = c.getUTCDay(); // 0 = Sunday, 1 = Monday ... 6 = Saturday
  const offset = (dow + 6) % 7; // days since Monday
  c.setUTCDate(c.getUTCDate() - offset);
  return c;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setUTCDate(c.getUTCDate() + n);
  return c;
}

/** YYYY-MM-DD in UTC. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string as a UTC midnight Date (no TZ drift). */
export function parseIsoDate(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Heat map + streak from attendance class_dates
// ─────────────────────────────────────────────────────────────────────────────

export type HeatmapDay = {
  /** YYYY-MM-DD */
  date: string;
  /** Number of classes attended that day (0+). */
  count: number;
};

export type HeatmapWeek = {
  /** Monday of this week (YYYY-MM-DD). */
  weekStart: string;
  /** 7 entries Mon..Sun. */
  days: HeatmapDay[];
  /** Distinct class days hit this week. */
  classCount: number;
  /** True if the student met their weekly target this week. */
  hitGoal: boolean;
};

export type ProgressSnapshot = {
  weeklyTarget: number;
  weeks: HeatmapWeek[];           // last N weeks oldest → newest
  currentWeek: HeatmapWeek;       // last entry, this week so far
  streakWeeks: number;            // consecutive completed weeks (excluding current if not yet hit)
  longestStreakWeeks: number;
  totalClasses: number;           // distinct attendance class_dates
  currentWeekCount: number;       // classes this week
};

/**
 * Build a heat map + streak summary for the trailing `weeksBack` weeks ending
 * on the week containing `now`.
 *
 * `classDates` is the list of attendance.class_date strings (YYYY-MM-DD).
 * Multiple rows on the same day count as a single class for goal purposes
 * (matches typical "did you train today?" mental model).
 */
export function buildProgressSnapshot(
  classDates: string[],
  weeklyTarget: number,
  weeksBack = 12,
  now: Date = new Date(),
): ProgressSnapshot {
  // Normalize → set of unique YYYY-MM-DD class days, count per day.
  const perDay = new Map<string, number>();
  for (const raw of classDates) {
    const day = (raw ?? "").slice(0, 10);
    if (!day) continue;
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
  }

  const thisWeekStart = startOfWeek(now);
  const weeks: HeatmapWeek[] = [];

  for (let w = weeksBack - 1; w >= 0; w--) {
    const weekStart = addDays(thisWeekStart, -7 * w);
    const days: HeatmapDay[] = [];
    let classCount = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const iso = toIsoDate(d);
      const count = perDay.get(iso) ?? 0;
      // Future days within current week show as 0 with date for layout.
      if (d.getTime() <= now.getTime() && count > 0) classCount += 1;
      days.push({ date: iso, count });
    }
    weeks.push({
      weekStart: toIsoDate(weekStart),
      days,
      classCount,
      hitGoal: classCount >= weeklyTarget,
    });
  }

  const currentWeek = weeks[weeks.length - 1]!;

  // Streak = consecutive completed weeks ending most recently.
  // The current (in-progress) week counts only if it has already hit the goal;
  // otherwise we look backward from the previous fully-elapsed week so an
  // in-progress week doesn't reset a live streak.
  const currentHit = weeks[weeks.length - 1]!.hitGoal;
  const streakStart = weeks.length - (currentHit ? 1 : 2);
  let streak = 0;
  for (let i = streakStart; i >= 0; i--) {
    if (weeks[i]!.hitGoal) streak += 1;
    else break;
  }

  let longest = 0;
  let run = 0;
  for (const w of weeks) {
    if (w.hitGoal) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  return {
    weeklyTarget,
    weeks,
    currentWeek,
    streakWeeks: streak,
    longestStreakWeeks: longest,
    totalClasses: perDay.size,
    currentWeekCount: currentWeek.classCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge catalog
// ─────────────────────────────────────────────────────────────────────────────

export type BadgeCategory = "attendance" | "belt" | "streak";

export type BadgeDef = {
  key: string;
  label: string;
  description: string;
  category: BadgeCategory;
  /** For attendance / streak badges: target value to hit. */
  threshold?: number;
};

export const ATTENDANCE_TIERS = [10, 25, 50, 100, 250, 500] as const;
export const STREAK_TIERS = [4, 12] as const; // ~30 days, ~90 days

export const BADGES: BadgeDef[] = [
  ...ATTENDANCE_TIERS.map<BadgeDef>((n) => ({
    key: `attendance_${n}`,
    label: `${n} Classes`,
    description: `Attended ${n} total classes.`,
    category: "attendance",
    threshold: n,
  })),
  {
    key: "streak_4",
    label: "30-Day Streak",
    description: "Hit your weekly goal four weeks in a row.",
    category: "streak",
    threshold: 4,
  },
  {
    key: "streak_12",
    label: "90-Day Streak",
    description: "Hit your weekly goal twelve weeks in a row.",
    category: "streak",
    threshold: 12,
  },
];

const BELT_BADGE_PREFIX = "belt_";

export function beltBadge(belt: BeltRank): BadgeDef {
  return {
    key: `${BELT_BADGE_PREFIX}${belt}`,
    label: `${BELT_LABEL[belt]} Belt`,
    description: `Promoted to ${BELT_LABEL[belt]} belt.`,
    category: "belt",
  };
}

export function badgeDefByKey(key: string): BadgeDef {
  if (key.startsWith(BELT_BADGE_PREFIX)) {
    const belt = key.slice(BELT_BADGE_PREFIX.length) as BeltRank;
    return beltBadge(belt);
  }
  const found = BADGES.find((b) => b.key === key);
  if (found) return found;
  return {
    key,
    label: key,
    description: "",
    category: "attendance",
  };
}

/**
 * Given a student's stats, return every badge they should currently own. The
 * server compares this against `student_badges` rows and inserts any missing.
 */
export function evaluateEarnedBadges(input: {
  totalClasses: number;
  longestStreakWeeks: number;
  currentBelt: BeltRank;
  /** All belts this student has touched (from belt_progress history if available). */
  beltHistory?: BeltRank[];
}): BadgeDef[] {
  const out: BadgeDef[] = [];

  for (const tier of ATTENDANCE_TIERS) {
    if (input.totalClasses >= tier) {
      out.push(BADGES.find((b) => b.key === `attendance_${tier}`)!);
    }
  }

  for (const tier of STREAK_TIERS) {
    if (input.longestStreakWeeks >= tier) {
      out.push(BADGES.find((b) => b.key === `streak_${tier}`)!);
    }
  }

  // Belt promotions: anything past white counts as a milestone.
  const belts = new Set<BeltRank>(input.beltHistory ?? []);
  belts.add(input.currentBelt);
  for (const belt of belts) {
    if (belt === "white") continue;
    out.push(beltBadge(belt));
  }

  // De-dupe by key (belt history could overlap).
  const seen = new Set<string>();
  return out.filter((b) => (seen.has(b.key) ? false : (seen.add(b.key), true)));
}

/**
 * Find the next attendance milestone the student is working toward.
 * Returns null if they have already earned the highest tier.
 */
export function nextAttendanceMilestone(
  totalClasses: number,
): { tier: number; remaining: number } | null {
  for (const tier of ATTENDANCE_TIERS) {
    if (totalClasses < tier) {
      return { tier, remaining: tier - totalClasses };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Weekly target options
// ─────────────────────────────────────────────────────────────────────────────

export const WEEKLY_TARGET_OPTIONS = [2, 3, 4, 5] as const;
export type WeeklyTarget = (typeof WEEKLY_TARGET_OPTIONS)[number];
