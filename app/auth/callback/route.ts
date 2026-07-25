import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserType } from "@/lib/auth/resolve-user-type";

// 30-day cookie lifetime for gym + role stamps
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

// Safe prefixes for the ?next= redirect. Must start with one of these to
// prevent open-redirect attacks (e.g. ?next=https://evil.com).
const ALLOWED_NEXT_PREFIXES = [
  "/dashboard",
  "/leads",
  "/students",
  "/billing",
  "/reports",
  "/schedule",
  "/settings",
  "/checkin",
  "/messages",
  "/frontdesk",
  "/portal",
  "/onboarding",
];

function safeNext(next: string | null): string | null {
  if (!next) return null;
  const decoded = decodeURIComponent(next);
  // Must be a relative path starting with one of the allowed prefixes.
  if (!decoded.startsWith("/")) return null;
  if (ALLOWED_NEXT_PREFIXES.some((p) => decoded === p || decoded.startsWith(p + "/"))) {
    return decoded;
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code       = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const nextParam  = safeNext(searchParams.get("next"));

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
  // Honor ?next= if it was passed through the magic link (validated above).
  // Fall back: staff → /dashboard, pure-student → /portal.
  const defaultDestination = userType.isStaff ? "/dashboard" : "/portal";
  const destination = nextParam ?? defaultDestination;

  const response = NextResponse.redirect(`${origin}${destination}`);

  // ── Stamp gym + role cookies for staff ───────────────────────────────────
  // Without these, getCurrentGymId() falls back to the user_gyms lookup on
  // every request instead of the fast cookie path, and the first render would
  // hit SelectGymState even though we already know their gym.
  const isProd = process.env.NODE_ENV === "production";
  if (userType.isStaff && userType.gymId) {
    response.cookies.set("mf-gym-id", userType.gymId, {
      path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax",
      httpOnly: true, secure: isProd,
    });
  }
  if (userType.isStaff && userType.role) {
    response.cookies.set("mf-role", userType.role, {
      path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax",
      httpOnly: true, secure: isProd,
    });
  }

  return response;
}
