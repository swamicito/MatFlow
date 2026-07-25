/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import type { ChallengeType, PassportChallenge } from "@/lib/gamification/challenges";

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

// ─── Types ────────────────────────────────────────────────────────────────────

export type PassportChallengeRow = PassportChallenge & {
  completions: number; // count of users who completed it
};

export type CreatePassportChallengeInput = {
  title: string;
  description?: string | null;
  challenge_type: ChallengeType;
  goal_value: number;
  points_reward: number;
  start_date: string; // YYYY-MM-DD
  end_date: string;
};

// ─── List ─────────────────────────────────────────────────────────────────────

export async function listPassportChallenges(): Promise<
  ActionResult<PassportChallengeRow[]>
> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data, error } = await supabase
    .from("passport_challenges")
    .select("*")
    .eq("gym_id", gymId)
    .order("start_date", { ascending: false });

  if (error) return { ok: false, error: error.message };

  // Count completions per challenge
  const ids = (data ?? []).map((c: any) => c.id as string);
  const countMap = new Map<string, number>();
  if (ids.length) {
    const { data: done } = await supabase
      .from("user_challenge_progress")
      .select("challenge_id")
      .in("challenge_id", ids)
      .not("completed_at", "is", null);
    for (const row of done ?? []) {
      countMap.set(row.challenge_id, (countMap.get(row.challenge_id) ?? 0) + 1);
    }
  }

  return {
    ok: true,
    data: (data ?? []).map((c: any) => ({
      ...c,
      completions: countMap.get(c.id) ?? 0,
    })),
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createPassportChallenge(
  input: CreatePassportChallengeInput,
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners or admins can manage challenges." };
  }

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (!input.challenge_type) return { ok: false, error: "Challenge type is required." };
  if (!Number.isFinite(input.goal_value) || input.goal_value <= 0) {
    return { ok: false, error: "Goal value must be a positive number." };
  }
  if (!Number.isFinite(input.points_reward) || input.points_reward < 0) {
    return { ok: false, error: "Points reward must be 0 or greater." };
  }
  if (!input.start_date || !input.end_date) {
    return { ok: false, error: "Start and end dates are required." };
  }
  if (input.start_date >= input.end_date) {
    return { ok: false, error: "End date must be after start date." };
  }

  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { error } = await supabase.from("passport_challenges").insert({
    gym_id:         gymId,
    title,
    description:    input.description?.trim() || null,
    challenge_type: input.challenge_type,
    goal_value:     Math.round(input.goal_value),
    points_reward:  Math.round(input.points_reward),
    start_date:     input.start_date,
    end_date:       input.end_date,
    is_active:      true,
  });

  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/challenges");
  return { ok: true };
}

// ─── Toggle active ────────────────────────────────────────────────────────────

export async function togglePassportChallenge(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners or admins can manage challenges." };
  }
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("passport_challenges")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/challenges");
  return { ok: true };
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deletePassportChallenge(id: string): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners or admins can manage challenges." };
  }
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("passport_challenges")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/challenges");
  return { ok: true };
}
