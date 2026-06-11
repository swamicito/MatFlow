/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import { GYM_COOKIE } from "@/lib/auth/current-gym";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  let body: { gymId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { gymId } = body;
  if (!gymId || typeof gymId !== "string" || gymId.length !== 36) {
    return NextResponse.json({ error: "Invalid gym ID" }, { status: 400 });
  }

  // Verify the gym actually exists before persisting the cookie
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from("gyms")
    .select("id, name, slug")
    .eq("id", gymId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "Gym not found" }, { status: 404 });
  }

  const res = NextResponse.json({ ok: true, gym: data });
  res.cookies.set(GYM_COOKIE, gymId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
