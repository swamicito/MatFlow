import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Badge, UserBadge, UserPassport } from "./types";

// ─── Read functions ───────────────────────────────────────────────────────────

/**
 * Returns all badge definitions, ordered by criteria_value ascending
 * (i.e., easiest to hardest within each type).
 */
export async function getAllBadges(): Promise<Badge[]> {
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("badges")
    .select("*")
    .order("criteria_value", { ascending: true });
  return (data ?? []) as Badge[];
}

/**
 * Returns all badges a user has earned in a gym, newest first.
 * Each row includes the joined badge definition under `.badge`.
 */
export async function getUserBadges(
  userId: string,
  gymId: string,
): Promise<UserBadge[]> {
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("user_badges")
    .select("*, badge:badges(*)")
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .order("earned_at", { ascending: false });
  return (data ?? []) as UserBadge[];
}

// ─── Belt rank ordinal map ────────────────────────────────────────────────────
// Matches the belt_rank enum in 0001_init.sql.
// Higher ordinal = more advanced belt.

const BELT_ORDINAL: Record<string, number> = {
  white: 0, gray: 1, yellow: 2, orange: 3,
  green: 4, blue: 5, purple: 6, brown: 7, black: 8,
};

// ─── Weekly consistency helper ────────────────────────────────────────────────
// A "qualifying week" has >= WEEKLY_CLASS_THRESHOLD classes.
// Returns the longest all-time streak of consecutive qualifying weeks.

const WEEKLY_CLASS_THRESHOLD = 3;

export function computeMaxConsistentWeeks(
  rows: Array<{ class_date: string }>,
): number {
  if (rows.length === 0) return 0;

  // Compute the Monday date (UTC) for the week containing a class_date string.
  function weekMonday(dateStr: string): string {
    const d = new Date(dateStr + "T00:00:00Z");
    const dow = d.getUTCDay(); // 0 = Sun, 1 = Mon … 6 = Sat
    const offset = dow === 0 ? -6 : 1 - dow;
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().split("T")[0]; // "YYYY-MM-DD" of that Monday
  }

  // Aggregate class count per week.
  const weekCount = new Map<string, number>();
  for (const row of rows) {
    const mon = weekMonday(row.class_date);
    weekCount.set(mon, (weekCount.get(mon) ?? 0) + 1);
  }

  // Collect qualifying weeks, sorted chronologically.
  const qualifying = [...weekCount.entries()]
    .filter(([, n]) => n >= WEEKLY_CLASS_THRESHOLD)
    .map(([mon]) => mon)
    .sort();

  if (qualifying.length === 0) return 0;

  // Find the longest run of consecutive weeks (each exactly 7 days apart).
  let maxRun = 1;
  let run    = 1;
  for (let i = 1; i < qualifying.length; i++) {
    const prev = new Date(qualifying[i - 1] + "T00:00:00Z");
    const curr = new Date(qualifying[i]     + "T00:00:00Z");
    const diffDays = (curr.getTime() - prev.getTime()) / 86_400_000;
    if (diffDays === 7) {
      run++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 1;
    }
  }

  return maxRun;
}

// ─── Badge evaluation ─────────────────────────────────────────────────────────

/**
 * Evaluates every unearned badge against the user's current state and
 * awards any that the user now qualifies for.
 *
 * Called *after* the passport has been updated so points/streak values
 * are current before evaluation.
 *
 * Criteria types supported:
 *   ✅ "points"              — passport.points >= criteria_value
 *   ✅ "streak"              — longest_streak  >= criteria_value
 *   ✅ "classes_attended"    — total attendance rows for the linked student
 *   ✅ "challenge_complete"  — completed Passport Challenge count
 *   ✅ "belt_rank"           — student's belt_rank ordinal >= criteria_value
 *   ✅ "weekly_consistency"  — max consecutive qualifying weeks >= criteria_value
 *                             (qualifying = >= 3 classes in the week)
 *
 * @returns Newly awarded UserBadge rows (empty array if nothing new).
 */
export async function checkAndAwardBadges(
  userId: string,
  gymId: string,
): Promise<UserBadge[]> {
  const admin = createAdminClient() as any;

  // ── Round 1 (parallel) ─────────────────────────────────────────────────────
  // Fetch everything that doesn't require knowing which badge types are
  // unevaluated: passport state, earned badge ids, full badge catalogue,
  // student_auth mapping, and challenge completion count.
  const [passportRes, earnedRes, allBadgesRes, studentAuthRes, challengesDoneRes] =
    await Promise.all([
      admin
        .from("user_passport")
        .select("*")
        .eq("user_id", userId)
        .eq("gym_id", gymId)
        .maybeSingle(),
      admin
        .from("user_badges")
        .select("badge_id")
        .eq("user_id", userId)
        .eq("gym_id", gymId),
      admin.from("badges").select("*"),
      admin
        .from("student_auth")
        .select("student_id")
        .eq("auth_user_id", userId)
        .maybeSingle(),
      admin
        .from("user_challenge_progress")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("gym_id", gymId)
        .not("completed_at", "is", null),
    ]);

  const passport = passportRes.data as UserPassport | null;
  if (!passport) return []; // no passport yet — nothing to evaluate

  const earnedIds = new Set<string>(
    ((earnedRes.data ?? []) as { badge_id: string }[]).map((r) => r.badge_id),
  );
  const allBadges = (allBadgesRes.data ?? []) as Badge[];
  const challengesCompleted = (challengesDoneRes.count ?? 0) as number;
  const studentId = (studentAuthRes.data as any)?.student_id as string | undefined;

  // ── Round 2 (conditional, parallel) ───────────────────────────────────────
  // Run only the DB lookups needed by unevaluated badge types.
  // Weekly_consistency needs full attendance rows; if that fetch is already
  // happening we derive the classes_attended count from the same rows so we
  // never hit attendance twice.

  const needsBeltRank  = allBadges.some((b) => !earnedIds.has(b.id) && b.criteria_type === "belt_rank");
  const needsWeekly    = allBadges.some((b) => !earnedIds.has(b.id) && b.criteria_type === "weekly_consistency");
  const needsClassOnly = !needsWeekly && allBadges.some((b) => !earnedIds.has(b.id) && b.criteria_type === "classes_attended");

  let classesAttended    = 0;
  let beltOrdinal        = -1;
  let maxConsistentWeeks = 0;

  if (studentId) {
    await Promise.all([
      // Attendance — full rows when weekly_consistency is needed;
      // count-only when only classes_attended badges are unevaluated.
      (needsWeekly || needsClassOnly)
        ? (async () => {
            if (needsWeekly) {
              const { data } = await admin
                .from("attendance")
                .select("class_date")
                .eq("student_id", studentId);
              const rows = (data ?? []) as Array<{ class_date: string }>;
              classesAttended    = rows.length;
              maxConsistentWeeks = computeMaxConsistentWeeks(rows);
            } else {
              const { count } = await admin
                .from("attendance")
                .select("id", { count: "exact", head: true })
                .eq("student_id", studentId);
              classesAttended = (count ?? 0) as number;
            }
          })()
        : Promise.resolve(),

      // Belt rank ordinal
      needsBeltRank
        ? (async () => {
            const { data } = await admin
              .from("students")
              .select("belt_rank")
              .eq("id", studentId)
              .maybeSingle();
            beltOrdinal = BELT_ORDINAL[(data as any)?.belt_rank ?? ""] ?? -1;
          })()
        : Promise.resolve(),
    ]);
  }

  // ── Determine newly qualifying badges ──────────────────────────────────────
  const newlyQualified: string[] = [];

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;

    let qualifies = false;
    switch (badge.criteria_type) {
      case "points":
        qualifies = passport.points >= badge.criteria_value;
        break;

      case "streak":
        // Use longest_streak so badges survive after a streak reset.
        qualifies = passport.longest_streak >= badge.criteria_value;
        break;

      case "classes_attended":
        qualifies = classesAttended >= badge.criteria_value;
        break;

      case "challenge_complete":
        qualifies = challengesCompleted >= badge.criteria_value;
        break;

      case "belt_rank":
        qualifies = beltOrdinal >= badge.criteria_value;
        break;

      case "weekly_consistency":
        qualifies = maxConsistentWeeks >= badge.criteria_value;
        break;

      default:
        break;
    }

    if (qualifies) newlyQualified.push(badge.id);
  }

  if (newlyQualified.length === 0) return [];

  // ── Insert new user_badges rows ────────────────────────────────────────────
  // The unique constraint (user_id, gym_id, badge_id) handles concurrent
  // race conditions — duplicate inserts are silently ignored.
  const inserts = newlyQualified.map((badge_id) => ({
    user_id:  userId,
    gym_id:   gymId,
    badge_id,
  }));

  const { data: inserted, error } = await admin
    .from("user_badges")
    .upsert(inserts, { onConflict: "user_id,gym_id,badge_id" })
    .select("*, badge:badges(*)");

  if (error) {
    console.error("[checkAndAwardBadges] insert error:", error.message);
    return [];
  }

  return (inserted ?? []) as UserBadge[];
}
