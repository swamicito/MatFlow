/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import {
  ATTENDANCE_TIERS,
  BADGES,
  STREAK_TIERS,
  buildProgressSnapshot,
  evaluateEarnedBadges,
  nextAttendanceMilestone,
  WEEKLY_TARGET_OPTIONS,
  type ProgressSnapshot,
  type WeeklyTarget,
} from "@/lib/gamification";
import type { BeltRank, Database } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };


// ─────────────────────────────────────────────────────────────────────────────
// Public types returned to the client
// ─────────────────────────────────────────────────────────────────────────────

export type EarnedBadge = {
  key: string;
  label: string;
  description: string;
  category: "attendance" | "belt" | "streak";
  earned_at: string | null; // null = locked
};

export type StudentChallengeView = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  target_classes: number;
  start_date: string;
  end_date: string;
  joined: boolean;
  classes_during_window: number;
  completed: boolean;
};

export type StudentProgress = {
  studentId: string;
  snapshot: ProgressSnapshot;
  earnedBadges: EarnedBadge[];
  lockedBadges: EarnedBadge[];
  newlyEarnedKeys: string[];
  nextMilestone: { tier: number; remaining: number } | null;
  challenges: StudentChallengeView[];
};

// ─────────────────────────────────────────────────────────────────────────────
// getStudentProgress: one round-trip view used by the Progress section.
// Also awards any missing badges as a side effect.
// ─────────────────────────────────────────────────────────────────────────────

export async function getStudentProgress(
  studentId: string,
): Promise<ActionResult<StudentProgress>> {
  if (!studentId) return { ok: false, error: "studentId required" };
  const supabase = createAdminClient() as any;

  const [studentRes, attendanceRes, goalRes, beltRes, badgesRes] = await Promise.all([
    supabase.from("students").select("id, gym_id, belt_rank").eq("id", studentId).single(),
    supabase
      .from("attendance")
      .select("class_date")
      .eq("student_id", studentId)
      .order("class_date", { ascending: false }),
    supabase
      .from("student_goals")
      .select("weekly_target")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("belt_progress")
      .select("current_belt")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("student_badges")
      .select("badge_key, earned_at")
      .eq("student_id", studentId),
  ]);

  if (studentRes.error || !studentRes.data) {
    return { ok: false, error: studentRes.error?.message ?? "Student not found" };
  }
  if (attendanceRes.error) return { ok: false, error: attendanceRes.error.message };

  const weeklyTarget: WeeklyTarget =
    (goalRes.data?.weekly_target as WeeklyTarget) ?? 3;
  const classDates = (attendanceRes.data ?? []).map((r: any) => r.class_date);
  const snapshot = buildProgressSnapshot(classDates, weeklyTarget, 12);

  const currentBelt: BeltRank =
    (beltRes.data?.current_belt as BeltRank) ?? studentRes.data.belt_rank;

  const expected = evaluateEarnedBadges({
    totalClasses: snapshot.totalClasses,
    longestStreakWeeks: snapshot.longestStreakWeeks,
    currentBelt,
    beltHistory: [currentBelt],
  });

  const existingByKey = new Map<string, string | null>(
    (badgesRes.data ?? []).map((b: any) => [b.badge_key as string, b.earned_at as string | null]),
  );

  // Insert any newly earned badges. Unique constraint on (student_id, badge_key).
  const toInsert = expected
    .filter((b: any) => !existingByKey.has(b.key))
    .map((b: any) => ({ student_id: studentId, badge_key: b.key }));
  const newlyEarnedKeys: string[] = [];
  if (toInsert.length) {
    const ins = await supabase
      .from("student_badges")
      .insert(toInsert)
      .select("badge_key, earned_at");
    if (!ins.error) {
      for (const row of ins.data ?? []) {
        existingByKey.set(row.badge_key, row.earned_at);
        newlyEarnedKeys.push(row.badge_key);
      }
    }
  }

  // Build earned + locked lists. Locked = belt + attendance + streak tiers
  // not yet hit (so the UI can show progress).
  const earnedBadges: EarnedBadge[] = expected.map((b: any) => ({
    key: b.key,
    label: b.label,
    description: b.description,
    category: b.category,
    earned_at: existingByKey.get(b.key) ?? null,
  }));

  const allTierKeys = new Set(expected.map((b: any) => b.key));
  const lockedBadges: EarnedBadge[] = [];
  for (const tier of ATTENDANCE_TIERS) {
    const k = `attendance_${tier}`;
    if (!allTierKeys.has(k)) {
      const def = BADGES.find((b: any) => b.key === k)!;
      lockedBadges.push({ ...def, earned_at: null });
    }
  }
  for (const tier of STREAK_TIERS) {
    const k = `streak_${tier}`;
    if (!allTierKeys.has(k)) {
      const def = BADGES.find((b: any) => b.key === k)!;
      lockedBadges.push({ ...def, earned_at: null });
    }
  }

  // Active challenges + per-student progress.
  const today = new Date().toISOString().slice(0, 10);
  const challengesRes = await supabase
    .from("challenges")
    .select("*")
    .eq("gym_id", studentRes.data.gym_id)
    .eq("enabled", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("end_date", { ascending: true });

  const myParticipationsRes = challengesRes.data?.length
    ? await supabase
        .from("challenge_participants")
        .select("challenge_id, completed_at")
        .eq("student_id", studentId)
        .in(
          "challenge_id",
          challengesRes.data.map((c: any) => c.id),
        )
    : { data: [] as { challenge_id: string; completed_at: string | null }[], error: null };

  const myJoined = new Set(
    (myParticipationsRes.data ?? []).map((p: any) => p.challenge_id),
  );

  const dateSet = new Set<string>(classDates.map((d: any) => (d ?? "").slice(0, 10)));
  const challenges: StudentChallengeView[] = (challengesRes.data ?? []).map((c: any) => {
    let count = 0;
    for (const d of dateSet as Set<string>) {
      if (d >= c.start_date && d <= c.end_date) count += 1;
    }
    return {
      id: c.id,
      key: c.key,
      title: c.title,
      description: c.description,
      target_classes: c.target_classes,
      start_date: c.start_date,
      end_date: c.end_date,
      joined: myJoined.has(c.id),
      classes_during_window: count,
      completed: count >= c.target_classes,
    };
  });

  return {
    ok: true,
    data: {
      studentId,
      snapshot,
      earnedBadges,
      lockedBadges,
      newlyEarnedKeys,
      nextMilestone: nextAttendanceMilestone(snapshot.totalClasses),
      challenges,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// setWeeklyGoal
// ─────────────────────────────────────────────────────────────────────────────

export async function setWeeklyGoal(
  studentId: string,
  weeklyTarget: number,
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_students")) {
    return { ok: false, error: "You don't have permission to edit students." };
  }
  if (!WEEKLY_TARGET_OPTIONS.includes(weeklyTarget as WeeklyTarget)) {
    return { ok: false, error: "Pick 2, 3, 4, or 5 classes per week." };
  }
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("student_goals")
    .upsert(
      {
        student_id: studentId,
        weekly_target: weeklyTarget,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/students");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Challenge join / leave (called from the Progress section)
// ─────────────────────────────────────────────────────────────────────────────

export async function joinChallenge(
  challengeId: string,
  studentId: string,
): Promise<ActionResult> {
  if (!challengeId || !studentId) {
    return { ok: false, error: "Missing challenge or student." };
  }
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("challenge_participants")
    .upsert(
      { challenge_id: challengeId, student_id: studentId },
      { onConflict: "challenge_id,student_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/students");
  revalidatePath("/settings/challenges");
  return { ok: true };
}

export async function leaveChallenge(
  challengeId: string,
  studentId: string,
): Promise<ActionResult> {
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("challenge_participants")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("student_id", studentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/students");
  revalidatePath("/settings/challenges");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Challenge admin (gym owner): create / toggle / delete
// ─────────────────────────────────────────────────────────────────────────────

export type CreateChallengeInput = {
  title: string;
  description?: string | null;
  target_classes: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  key?: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export async function createChallenge(
  input: CreateChallengeInput,
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners or admins can manage challenges." };
  }
  if (!input.title?.trim()) return { ok: false, error: "Title required." };
  if (input.start_date >= input.end_date) {
    return { ok: false, error: "End date must be after start date." };
  }
  if (!Number.isFinite(input.target_classes) || input.target_classes <= 0) {
    return { ok: false, error: "Target classes must be > 0." };
  }
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const baseKey = input.key?.trim() || slugify(input.title);
  if (!baseKey) return { ok: false, error: "Could not derive challenge key." };

  // Ensure key is unique per gym.
  let key = baseKey;
  for (let i = 2; i < 100; i++) {
    const existing = await supabase
      .from("challenges")
      .select("id")
      .eq("gym_id", gymId)
      .eq("key", key)
      .maybeSingle();
    if (!existing.data) break;
    key = `${baseKey}_${i}`;
  }

  const { error } = await supabase.from("challenges").insert({
    gym_id: gymId,
    key,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    target_classes: Math.round(input.target_classes),
    start_date: input.start_date,
    end_date: input.end_date,
    enabled: true,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/challenges");
  return { ok: true };
}

export async function setChallengeEnabled(
  challengeId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners or admins can manage challenges." };
  }
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("challenges")
    .update({ enabled })
    .eq("id", challengeId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/challenges");
  return { ok: true };
}

export async function deleteChallenge(
  challengeId: string,
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners or admins can manage challenges." };
  }
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("challenges")
    .delete()
    .eq("id", challengeId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/challenges");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Leaderboard for a single challenge (top 10)
// ─────────────────────────────────────────────────────────────────────────────

export type LeaderboardRow = {
  student_id: string;
  full_name: string;
  classes: number;
  target: number;
  completed: boolean;
};

export async function getChallengeLeaderboard(
  challengeId: string,
  limit = 10,
): Promise<ActionResult<LeaderboardRow[]>> {
  const supabase = createAdminClient() as any;
  const challengeRes = await supabase
    .from("challenges")
    .select("*")
    .eq("id", challengeId)
    .single();
  if (challengeRes.error || !challengeRes.data) {
    return { ok: false, error: "Challenge not found." };
  }
  const challenge = challengeRes.data;

  const partsRes = await supabase
    .from("challenge_participants")
    .select("student_id, students:students(id, full_name)")
    .eq("challenge_id", challengeId);
  if (partsRes.error) return { ok: false, error: partsRes.error.message };

  type PartRow = { student_id: string; students: { id: string; full_name: string } | null };
  const participants = (partsRes.data ?? []) as unknown as PartRow[];
  if (participants.length === 0) return { ok: true, data: [] };

  const studentIds = participants.map((p: any) => p.student_id);
  const attendanceRes = await supabase
    .from("attendance")
    .select("student_id, class_date")
    .in("student_id", studentIds)
    .gte("class_date", challenge.start_date)
    .lte("class_date", challenge.end_date);
  if (attendanceRes.error) return { ok: false, error: attendanceRes.error.message };

  // Distinct days per student.
  const perStudent = new Map<string, Set<string>>();
  for (const r of attendanceRes.data ?? []) {
    const set = perStudent.get(r.student_id) ?? new Set<string>();
    set.add((r.class_date ?? "").slice(0, 10));
    perStudent.set(r.student_id, set);
  }

  const rows: LeaderboardRow[] = participants.map((p: any) => {
    const classes = perStudent.get(p.student_id)?.size ?? 0;
    return {
      student_id: p.student_id,
      full_name: p.students?.full_name ?? "Unknown",
      classes,
      target: challenge.target_classes,
      completed: classes >= challenge.target_classes,
    };
  });
  rows.sort((a, b) => b.classes - a.classes || a.full_name.localeCompare(b.full_name));
  return { ok: true, data: rows.slice(0, limit) };
}

export type ChallengeAdminRow =
  Database["public"]["Tables"]["challenges"]["Row"] & {
    participants: number;
  };

export async function listChallengesForAdmin(): Promise<
  ActionResult<ChallengeAdminRow[]>
> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const challengesRes = await supabase
    .from("challenges")
    .select("*")
    .eq("gym_id", gymId)
    .order("start_date", { ascending: false });
  if (challengesRes.error) return { ok: false, error: challengesRes.error.message };

  const ids = (challengesRes.data ?? []).map((c: any) => c.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const partRes = await supabase
      .from("challenge_participants")
      .select("challenge_id")
      .in("challenge_id", ids);
    for (const row of partRes.data ?? []) {
      counts.set(row.challenge_id, (counts.get(row.challenge_id) ?? 0) + 1);
    }
  }

  return {
    ok: true,
    data: (challengesRes.data ?? []).map((c: any) => ({
      ...c,
      participants: counts.get(c.id) ?? 0,
    })),
  };
}
