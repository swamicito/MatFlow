/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/supabase/types";

export type UserType = {
  isStaff:   boolean;        // Has a profile / user_gyms entry linked to a gym
  isStudent: boolean;        // Has a student_auth entry (or was just auto-linked)
  isDual:    boolean;        // Both — e.g. a gym owner who also trains
  gymId:     string | null;  // First gym the staff user belongs to
  role:      UserRole | null; // Staff role from profiles or user_gyms
  studentId: string | null;  // Matched student record ID
};

/**
 * Resolves the type of a user who just authenticated via magic link.
 *
 * Checks both sides of the user graph in parallel:
 *  • Staff  — `profiles` (legacy single-gym) OR `user_gyms` (multi-gym)
 *  • Student — `student_auth`; auto-creates the mapping if a student record
 *              exists with a matching email and hasn't been linked yet.
 *
 * This is the single source of truth for the /auth/callback redirect decision.
 */
export async function resolveUserType(
  authUserId: string,
  email: string | undefined,
): Promise<UserType> {
  const admin = createAdminClient() as any;

  // ── Parallel lookup: profile, user_gyms, student_auth ───────────────────
  const [profileRes, gymRes, studentAuthRes] = await Promise.all([
    admin
      .from("profiles")
      .select("role, gym_id")
      .eq("id", authUserId)
      .maybeSingle(),
    admin
      .from("user_gyms")
      .select("gym_id, role")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin
      .from("student_auth")
      .select("student_id")
      .eq("auth_user_id", authUserId)
      .maybeSingle(),
  ]);

  // ── Staff resolution ─────────────────────────────────────────────────────
  // Prefer user_gyms (multi-gym) over profiles.gym_id (legacy).
  const gymId: string | null =
    gymRes.data?.gym_id ?? profileRes.data?.gym_id ?? null;
  const role: UserRole | null =
    gymRes.data?.role ?? profileRes.data?.role ?? null;
  const isStaff = !!gymId;

  // ── Student resolution — auto-link on first login ────────────────────────
  let studentId: string | null = studentAuthRes.data?.student_id ?? null;

  if (!studentId && email) {
    // No student_auth row yet. If a student record with this email exists,
    // create the mapping so future logins resolve instantly.
    const { data: studentByEmail } = await admin
      .from("students")
      .select("id")
      .ilike("email", email.trim())
      .maybeSingle();

    if (studentByEmail?.id) {
      const { error: upsertErr } = await admin
        .from("student_auth")
        .upsert(
          { auth_user_id: authUserId, student_id: studentByEmail.id },
          { onConflict: "auth_user_id" },
        );
      if (!upsertErr) studentId = studentByEmail.id as string;
    }
  }

  const isStudent = !!studentId;

  return {
    isStaff,
    isStudent,
    isDual:    isStaff && isStudent,
    gymId,
    role,
    studentId,
  };
}
