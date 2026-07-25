// ─── MatFlow Passport — shared types ─────────────────────────────────────────
// These are hand-authored interfaces that mirror the DB schema in
// supabase/migrations/0020_passport.sql.  Re-run `supabase gen types
// typescript` after applying the migration to get auto-generated types too.

export type CriteriaType =
  | "points"
  | "streak"
  | "classes_attended"
  | "belt_rank"
  | "challenge_complete"
  | "weekly_consistency";

// ─── DB row shapes ────────────────────────────────────────────────────────────

export type UserPassport = {
  id: string;
  user_id: string;
  gym_id: string;
  points: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_checkin_date: string | null; // ISO date "YYYY-MM-DD"
  created_at: string;
  updated_at: string;
};

export type Badge = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;     // emoji or icon key
  criteria_type: CriteriaType;
  criteria_value: number;
  created_at: string;
};

export type UserBadge = {
  id: string;
  user_id: string;
  gym_id: string;
  badge_id: string;
  earned_at: string;
  // Populated when queried with a join:
  badge?: Badge;
};

export type PointLedgerEntry = {
  id: string;
  user_id: string;
  gym_id: string;
  points: number;   // negative values represent deductions
  reason: string;
  created_at: string;
};

// ─── Level formula ────────────────────────────────────────────────────────────
// Simple linear scale: every 100 points = +1 level, starting at level 1.
// Level 1: 0–99 pts   Level 2: 100–199 pts   Level 3: 200–299 pts  …

export const POINTS_PER_LEVEL = 100;

/** Derives the level for a given point total. Always >= 1. */
export function levelForPoints(points: number): number {
  return Math.floor(Math.max(0, points) / POINTS_PER_LEVEL) + 1;
}

/** How many more points are needed to reach the next level. */
export function pointsToNextLevel(points: number): number {
  const current = levelForPoints(points);
  return current * POINTS_PER_LEVEL - points;
}

/** Progress (0–1) through the current level band. */
export function levelProgress(points: number): number {
  const intoLevel = points % POINTS_PER_LEVEL;
  return intoLevel / POINTS_PER_LEVEL;
}

// ─── Point reason constants ───────────────────────────────────────────────────

export const PointReason = {
  CLASS_CHECKIN:       "class_checkin",
  DAILY_LOGIN:         "daily_login",
  CHALLENGE_COMPLETE:  "challenge_complete",
  BADGE_EARNED:        "badge_earned",
  MANUAL_AWARD:        "manual_award",
  MANUAL_DEDUCTION:    "manual_deduction",
} as const;

export type PointReasonKey = (typeof PointReason)[keyof typeof PointReason];
