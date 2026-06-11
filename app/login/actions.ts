"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function sendMagicLink(email: string) {
  const supabase = createAdminClient();

  const { error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/auth/callback`,
    },
  });

  if (error) {
    console.error("Magic link error:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ============================================
// DEV ONLY - Test Login as Steve
// ============================================
export async function testLoginAsSteve() {
  const supabase = createAdminClient();

  const testEmail = "dev-steve@matflow.test";
  const testPassword = "test123456";

  // 1. Try to sign in first
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (!signInError) {
    redirect("/portal");
  }

  // 2. Create test auth user
  const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: "Steve Breslau" },
  });

  if (createError) {
    console.error("Create test user error:", createError);
    return { success: false, error: createError.message };
  }

  // 3. Get gym ID
  const { data: gym } = await supabase
    .from("gyms")
    .select("id")
    .eq("slug", "asbury-park")
    .single();

  if (!gym?.id) {
    return { success: false, error: "Asbury Park gym not found" };
  }

  const gymId = gym.id;

  // 4. Find or create student (with type fix)
  let { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("email", "sbreslau3@gmail.com")
    .maybeSingle();

  if (!student) {
    const { data: newStudent } = await supabase
      .from("students")
      .insert({
        full_name: "Steve Breslau",
        email: "sbreslau3@gmail.com",
        phone: "732-555-0100",
        status: "active",
        belt_rank: "blue",
        stripes: 2,
        is_adult: true,
        gym_id: gymId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("id")
      .single();

    student = newStudent;
  }

  // 5. Link auth user
  if (student && authUser?.user) {
    await supabase.from("student_auth").upsert({
      student_id: student.id,
      auth_user_id: authUser.user.id,
    });
  }

  // 6. Sign in
  await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  redirect("/portal");
}