import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveOrCreateStudentAuth } from "@/lib/auth/current-student";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/portal";
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(errorParam)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // Resolve or create the student_auth mapping
  const studentId = await resolveOrCreateStudentAuth(user.id, user.email);

  if (!studentId) {
    // Auth succeeded but no matching student record found
    await supabase.auth.signOut();
    return NextResponse.redirect(
      `${origin}/login?error=no_student`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
