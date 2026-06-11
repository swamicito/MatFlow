/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StudentIdentity = {
  authUserId: string;
  studentId: string;
};

/**
 * Returns the portal student identity for the current request,
 * or null if the user is not authenticated / not linked to a student.
 *
 * Uses the Supabase server client (session cookies) to verify the auth user,
 * then looks up the student_auth mapping via the admin client.
 */
export async function getCurrentStudentIdentity(): Promise<StudentIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("student_auth")
    .select("student_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!data?.student_id) return null;
  return { authUserId: user.id, studentId: data.student_id };
}

/**
 * Given a verified auth user ID + email, resolves or creates the student_auth
 * mapping. Returns the student_id on success, null if no student matches.
 *
 * Called once per sign-in from /auth/callback.
 */
export async function resolveOrCreateStudentAuth(
  authUserId: string,
  email: string | undefined,
): Promise<string | null> {
  const admin = createAdminClient() as any;

  // 1. Already linked?
  const { data: existing } = await admin
    .from("student_auth")
    .select("student_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (existing?.student_id) return existing.student_id;

  // 2. Find a student by email
  if (!email) return null;
  const { data: student } = await admin
    .from("students")
    .select("id")
    .ilike("email", email.trim())
    .maybeSingle();
  if (!student?.id) return null;

  // 3. Create the mapping (ignore duplicate conflicts — race condition safe)
  const { error } = await admin.from("student_auth").upsert(
    { auth_user_id: authUserId, student_id: student.id },
    { onConflict: "auth_user_id" },
  );
  if (error) return null;

  return student.id;
}
