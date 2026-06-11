import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ROLE_COOKIE, isValidRole } from "@/lib/auth/current-role";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  let payload: { role?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const role = payload.role;
  if (!role || !isValidRole(role)) {
    return NextResponse.json(
      { ok: false, error: "Unknown role" },
      { status: 400 },
    );
  }
  const store = await cookies();
  store.set(ROLE_COOKIE, role, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return NextResponse.json({ ok: true, role });
}
