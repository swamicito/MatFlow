import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminClient } from "@/lib/supabase/admin";
import { awardPoints } from "./passport";
import { PointReason } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChallengeType = "class_count" | "streak" | "points_earned";

export type PassportChallenge = {
  id: string;
  gym_id: string;
  title: string;
  description: string | null;
  challenge_type: ChallengeType;
  goal_value: number;
  points_reward: number;
  start_date: string;  // ISO date "YYYY-MM-DD"
  end_date: string;    // ISO date "YYYY-MM-DD"
  is_active: boolean;
  created_at: string;
};

export type UserChallengeProgress = {
  id: string;
  user_id: string;
  gym_id: string;
  challenge_id: string;
  current_progress: number;
  completed_at: string | null;
  created_at: string;
};

/** Challenge enriched with real-time progress data for the UI. */
export type ChallengeWithProgress = PassportChallenge & {
  progress: number;      // current value
  goal: number;          // alias for goal_value — convenient in templates
  completed: boolean;
  completed_at: string | null;
  progress_pct: number;  // 0–100, capped at 100
  days_left: number;     // calendar days until end_date (0 = last day)
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function daysLeftFrom(endDate: string): number {
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
}

// ─── Read functions ───────────────────────────────────────────────────────────

/**
 * Returns all currently active challenge definitions for a gym.
 * A challenge is "active" when is_active=true AND today falls in [start_date, end_date].
 */
export async function getActiveChallenges(gymId: string): Promise<PassportChallenge[]> {
  const admin = createAdminClient() as any;
  const today = todayIso();
  const { data } = await admin
    .from("passport_challenges")
    .select("*")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("end_date", { ascending: true });
  return (data ?? []) as PassportChallenge[];
}

/**
 * Returns all user_challenge_progress rows for a user in a gym.
 */
export async function getUserChallengeProgress(
  userId: string,
  gymId: string,
): Promise<UserChallengeProgress[]> {
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("user_challenge_progress")
    .select("*")
    .eq("user_id", userId)
    .eq("gym_id", gymId);
  return (data ?? []) as UserChallengeProgress[];
}

/**
 * Combined query used by the UI.  Returns active challenges annotated with
 * the user's live progress and completion state.
 *
 * Progress computation per challenge_type:
 *  - class_count   → user_challenge_progress.current_progress (incremental)
 *  - streak        → user_passport.current_streak (live)
 *  - points_earned → sum of positive point_ledger entries within the
 *                    challenge's [start_date, end_date] window (not all-time)
 */
export async function getActiveChallengesWithProgress(
  userId: string,
  gymId: string,
): Promise<ChallengeWithProgress[]> {
  const admin = createAdminClient() as any;
  const today = todayIso();

  const [challengesRes, progressRes, passportRes] = await Promise.all([
    admin
      .from("passport_challenges")
      .select("*")
      .eq("gym_id", gymId)
      .eq("is_active", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("end_date", { ascending: true }),
    admin
      .from("user_challenge_progress")
      .select("*")
      .eq("user_id", userId)
      .eq("gym_id", gymId),
    admin
      .from("user_passport")
      .select("current_streak")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .maybeSingle(),
  ]);

  const challenges = (challengesRes.data ?? []) as PassportChallenge[];

  const progressMap = new Map<string, UserChallengeProgress>(
    ((progressRes.data ?? []) as UserChallengeProgress[]).map((p) => [p.challenge_id, p]),
  );

  const passport = passportRes.data as { current_streak: number } | null;

  // ── Window-scoped points for points_earned challenges ──────────────────────
  // Fetch point_ledger entries across the widest date window that covers all
  // active points_earned challenges, then sum per-challenge window in JS.
  // This costs exactly one extra DB query regardless of challenge count.
  const peChalls = challenges.filter((c) => c.challenge_type === "points_earned");
  const windowPoints = new Map<string, number>(); // challenge_id → pts in window

  if (peChalls.length > 0) {
    const minStart = peChalls.reduce(
      (m, c) => (c.start_date < m ? c.start_date : m),
      peChalls[0].start_date,
    );
    const maxEnd = peChalls.reduce(
      (m, c) => (c.end_date > m ? c.end_date : m),
      peChalls[0].end_date,
    );

    const { data: ledger } = await admin
      .from("point_ledger")
      .select("points, created_at")
      .eq("user_id", userId)
      .eq("gym_id", gymId)
      .gte("created_at", `${minStart}T00:00:00.000Z`)
      .lte("created_at", `${maxEnd}T23:59:59.999Z`);

    const entries = (ledger ?? []) as { points: number; created_at: string }[];

    for (const ch of peChalls) {
      const wStart = `${ch.start_date}T00:00:00.000Z`;
      const wEnd   = `${ch.end_date}T23:59:59.999Z`;
      const sum = entries
        .filter((e) => e.created_at >= wStart && e.created_at <= wEnd)
        .reduce((acc, e) => acc + Math.max(0, e.points), 0);
      windowPoints.set(ch.id, sum);
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  return challenges.map((ch) => {
    const stored = progressMap.get(ch.id);

    let progress = 0;
    switch (ch.challenge_type) {
      case "class_count":
        progress = stored?.current_progress ?? 0;
        break;
      case "streak":
        progress = passport?.current_streak ?? 0;
        break;
      case "points_earned":
        progress = windowPoints.get(ch.id) ?? 0;
        break;
    }

    const completed    = stored?.completed_at != null;
    const progress_pct = Math.min(100, Math.round((progress / ch.goal_value) * 100));
    const days_left    = daysLeftFrom(ch.end_date);

    return {
      ...ch,
      progress,
      goal:         ch.goal_value,
      completed,
      completed_at: stored?.completed_at ?? null,
      progress_pct,
      days_left,
    };
  });
}

// ─── Progress update ──────────────────────────────────────────────────────────

/**
 * Increments current_progress for all active class_count challenges by `delta`.
 * Creates the progress row if it doesn't exist yet.
 *
 * Called from checkInStudent() immediately after the attendance insert.
 */
export async function updateClassCountProgress(
  userId: string,
  gymId: string,
  delta = 1,
): Promise<void> {
  const admin = createAdminClient() as any;
  const today = todayIso();

  const { data: challenges } = await admin
    .from("passport_challenges")
    .select("id")
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .eq("challenge_type", "class_count")
    .lte("start_date", today)
    .gte("end_date", today);

  if (!challenges || challenges.length === 0) return;

  await Promise.all(
    (challenges as { id: string }[]).map(async ({ id: challenge_id }) => {
      const { data: existing } = await admin
        .from("user_challenge_progress")
        .select("id, current_progress")
        .eq("user_id", userId)
        .eq("challenge_id", challenge_id)
        .maybeSingle();

      if (existing) {
        await admin
          .from("user_challenge_progress")
          .update({ current_progress: (existing.current_progress as number) + delta })
          .eq("id", existing.id);
      } else {
        await admin.from("user_challenge_progress").insert({
          user_id:          userId,
          gym_id:           gymId,
          challenge_id,
          current_progress: delta,
        });
      }
    }),
  );
}

// ─── Completion ───────────────────────────────────────────────────────────────

/**
 * Marks a challenge complete for a user and awards the points_reward.
 *
 * Idempotent: re-reads the row to confirm completed_at is still null before
 * writing, so concurrent calls don't double-award.
 */
export async function awardChallengeCompletion(
  userId: string,
  gymId: string,
  challenge: PassportChallenge,
): Promise<void> {
  const admin = createAdminClient() as any;

  // Guard: abort if already completed (race-condition safety)
  const { data: existing } = await admin
    .from("user_challenge_progress")
    .select("completed_at")
    .eq("user_id", userId)
    .eq("challenge_id", challenge.id)
    .maybeSingle();

  if (existing?.completed_at) return;

  // Upsert progress row with completed_at set
  await admin.from("user_challenge_progress").upsert(
    {
      user_id:          userId,
      gym_id:           gymId,
      challenge_id:     challenge.id,
      current_progress: challenge.goal_value,
      completed_at:     new Date().toISOString(),
    },
    { onConflict: "user_id,challenge_id" },
  );

  // Award the points reward (non-fatal)
  if (challenge.points_reward > 0) {
    await awardPoints(userId, gymId, challenge.points_reward, PointReason.CHALLENGE_COMPLETE)
      .catch(() => void 0);
  }
}

/**
 * Evaluates every active challenge for a user and auto-completes any that
 * have met their goal.
 *
 * Called after check-in (class_count + streak) and after daily login (points).
 * Callers wrap this in try/catch — this function itself is non-throwing.
 *
 * @returns IDs of newly completed challenges (empty array if none).
 */
export async function evaluateAndCompleteChallenges(
  userId: string,
  gymId: string,
): Promise<string[]> {
  try {
    const withProgress = await getActiveChallengesWithProgress(userId, gymId);
    const newlyCompleted: string[] = [];

    for (const ch of withProgress) {
      if (ch.completed) continue;             // already won
      if (ch.progress < ch.goal_value) continue; // not yet

      await awardChallengeCompletion(userId, gymId, ch);
      newlyCompleted.push(ch.id);
    }

    return newlyCompleted;
  } catch {
    return [];
  }
}
