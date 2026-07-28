"use server";

import { createAdminClient } from "@/lib/supabase/admin";

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