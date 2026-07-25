import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  levelForPoints,
  PointReason,
  type UserPassport,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in UTC.
 *  TODO: pass gymTimezone and convert to local date once timezone is
 *        consistently stored on the gym record. */
function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

// ─── Core passport functions ──────────────────────────────────────────────────

/**
 * Returns the existing passport for a user+gym, or null if one doesn't exist yet.
 */
export async function getUserPassport(
  userId: string,
  gymId: string,
): Promise<UserPassport | null> {
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("user_passport")
    .select("*")
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .maybeSingle();
  return (data as UserPassport) ?? null;
}

/**
 * Returns the passport, creating it with defaults if it doesn't exist yet.
 * Callers should prefer this over getUserPassport() when they need to write
 * to the passport immediately afterwards.
 */
export async function getOrCreatePassport(
  userId: string,
  gymId: string,
): Promise<UserPassport> {
  const admin = createAdminClient() as any;

  const { data: existing } = await admin
    .from("user_passport")
    .select("*")
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (existing) return existing as UserPassport;

  const { data: created, error } = await admin
    .from("user_passport")
    .insert({ user_id: userId, gym_id: gymId })
    .select("*")
    .single();

  if (error || !created) {
    throw new Error(`Failed to create passport: ${error?.message ?? "unknown error"}`);
  }
  return created as UserPassport;
}

/**
 * Awards `points` to a user's passport and recalculates their level.
 * Also appends an immutable entry to the point_ledger (non-fatal).
 *
 * @returns The updated passport row.
 */
export async function awardPoints(
  userId: string,
  gymId: string,
  points: number,
  reason: string,
): Promise<UserPassport> {
  if (points === 0) return getOrCreatePassport(userId, gymId);

  const admin = createAdminClient() as any;
  const passport = await getOrCreatePassport(userId, gymId);

  const newPoints = Math.max(0, passport.points + points); // never go below 0
  const newLevel = levelForPoints(newPoints);

  const { data: updated, error } = await admin
    .from("user_passport")
    .update({ points: newPoints, level: newLevel })
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(`Failed to award points: ${error?.message ?? "unknown error"}`);
  }

  // Ledger entry — non-fatal
  admin
    .from("point_ledger")
    .insert({ user_id: userId, gym_id: gymId, points, reason })
    .then(() => void 0)
    .catch(() => void 0);

  return updated as UserPassport;
}

/**
 * Called when a student checks into a class.
 *
 * Rules:
 *  - Already checked in today → no-op (returns current passport unchanged).
 *  - Yesterday was last check-in → streak continues (+1).
 *  - Any other gap → streak resets to 1.
 *  - Streak only — does NOT award points. Call awardPoints() separately.
 *  - Updates longest_streak if current > previous longest.
 *
 * @returns The updated passport row.
 */
export async function updateStreakOnCheckin(
  userId: string,
  gymId: string,
): Promise<UserPassport> {
  const admin = createAdminClient() as any;
  const passport = await getOrCreatePassport(userId, gymId);
  const today = todayUtc();

  // Idempotency guard: already processed today's check-in.
  if (passport.last_checkin_date === today) return passport;

  // ── Compute new streak ──────────────────────────────────────────────────
  let newStreak: number;

  if (!passport.last_checkin_date) {
    newStreak = 1; // first ever check-in
  } else {
    const lastDate = new Date(passport.last_checkin_date);
    const todayDate = new Date(today);
    const diffDays = Math.round(
      (todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    newStreak = diffDays === 1
      ? passport.current_streak + 1 // consecutive day
      : 1;                           // missed ≥1 day — reset
  }

  const newLongest = Math.max(newStreak, passport.longest_streak);

  const { data: updated, error } = await admin
    .from("user_passport")
    .update({
      current_streak:    newStreak,
      longest_streak:    newLongest,
      last_checkin_date: today,
    })
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .select("*")
    .single();

  if (error || !updated) {
    throw new Error(`Failed to update streak: ${error?.message ?? "unknown error"}`);
  }

  return updated as UserPassport;
}

/**
 * Awards a small daily login bonus (+5 pts) once per calendar day.
 * Idempotent: checks point_ledger before inserting so repeated portal
 * visits within the same UTC day are no-ops.
 *
 * @returns `true` if the bonus was awarded in this call,
 *          `false` if it was already awarded today or an error occurred.
 */
export const awardDailyLoginBonus = cache(async function awardDailyLoginBonusImpl(
  userId: string,
  gymId: string,
): Promise<boolean> {
  try {
    const today = todayUtc();
    const admin = createAdminClient() as any;

    // One DB read: did we already award the bonus today?
    const { data: existing } = await admin
      .from("point_ledger")
      .select("id")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .eq("reason", PointReason.DAILY_LOGIN)
      .gte("created_at", `${today}T00:00:00.000Z`)
      .lte("created_at", `${today}T23:59:59.999Z`)
      .maybeSingle();

    if (existing) return false; // already awarded today

    await awardPoints(userId, gymId, 5, PointReason.DAILY_LOGIN);
    return true;
  } catch {
    return false; // never break a page load for a bonus
  }
});

/**
 * Returns recent point history for a user in a gym.
 * Useful for building an "activity feed" on the passport page.
 */
export async function getPointLedger(
  userId: string,
  gymId: string,
  limit = 20,
) {
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("point_ledger")
    .select("*")
    .eq("user_id", userId)
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
