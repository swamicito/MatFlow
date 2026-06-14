/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { GYM_COOKIE } from "@/lib/auth/current-gym";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Strict UUID format — rejects any non-UUID value up front.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  // ── Parse body ──────────────────────────────────────────────────────────
  let body: { gymId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { gymId } = body;
  if (!gymId || typeof gymId !== "string" || !UUID_RE.test(gymId)) {
    return NextResponse.json({ error: "Invalid gym ID" }, { status: 400 });
  }

  // ── 1. Require a valid Supabase auth session ─────────────────────────────
  //
  // Previously this route had NO auth check — any request (authenticated or
  // not) could switch to any gym simply by knowing its UUID.
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  // ── 2. Verify the user is a member of the requested gym ──────────────────
  //
  // Previously only checked that the gym existed in the gyms table — no
  // user-to-gym membership was verified.  A user who knew any gym's UUID could
  // switch into it and read all of its data.
  const admin = createAdminClient() as any;
  const { data: membership } = await admin
    .from("user_gyms")
    .select("gym_id, role")
    .eq("user_id", user.id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this gym." },
      { status: 403 },
    );
  }

  // ── 3. Fetch gym details (also confirms the row still exists) ────────────
  const { data: gym } = await admin
    .from("gyms")
    .select("id, name, slug")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym) {
    return NextResponse.json({ error: "Gym not found." }, { status: 404 });
  }

  // ── 4. All checks passed — set the gym cookie ────────────────────────────
  const res = NextResponse.json({ ok: true, gym });
  res.cookies.set(GYM_COOKIE, gymId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
