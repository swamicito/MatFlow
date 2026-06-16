import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserType } from "@/lib/auth/resolve-user-type";

// 30-day cookie lifetime for gym + role stamps
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // ── Smart role detection ─────────────────────────────────────────────────
  // Checks profiles / user_gyms (staff) and student_auth (student) in parallel.
  // Auto-links a student_auth row when a student record with this email exists
  // but hasn't been linked yet (handles first-time magic-link logins).
  const userType = await resolveUserType(user.id, user.email);

  if (!userType.isStaff && !userType.isStudent) {
    // Auth succeeded but this email isn't in the system as staff or student.
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=no_account`);
  }

  // ── Routing decision ─────────────────────────────────────────────────────
  // Dual-role and pure-staff both land in the coaching dashboard.
  // Pure-student lands in the student portal.
  const destination = userType.isStaff ? "/dashboard" : "/portal";

  const response = NextResponse.redirect(`${origin}${destination}`);

  // ── Stamp gym + role cookies for staff ───────────────────────────────────
  // Without these, getCurrentGymId() falls back to the user_gyms lookup on
  // every request instead of the fast cookie path, and the first render would
  // hit SelectGymState even though we already know their gym.
  if (userType.isStaff && userType.gymId) {
    response.cookies.set("mf-gym-id", userType.gymId, {
      path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax", httpOnly: false,
    });
  }
  if (userType.isStaff && userType.role) {
    response.cookies.set("mf-role", userType.role, {
      path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax", httpOnly: false,
    });
  }

  return response;
}
