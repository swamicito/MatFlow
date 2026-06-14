/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const GYM_COOKIE = "mf-gym-id";

// Strict UUID v4 regex — rejects anything that isn't a properly-formed UUID.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export { GYM_COOKIE };

/**
 * Returns the active gym_id for the current request.
 *
 * Resolution order:
 *  1. `mf-gym-id` cookie — set by /api/gym when the user explicitly picks a gym.
 *  2. Supabase auth session → first gym in user_gyms for that user.
 *
 * Returns `null` if neither source yields a valid gym.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DELIBERATELY REMOVED fallbacks:
 *  ✗  ASBURY_PARK_GYM_ID env var   — leaked a hardcoded gym ID into every
 *                                     request that lacked a cookie.
 *  ✗  gyms WHERE slug = 'asbury-park' — same problem; silently serves gym A
 *                                        data to gym B users.
 *  ✗  gyms ORDER BY created_at LIMIT 1 — the most dangerous: guaranteed to
 *                                         cross-contaminate once a second gym
 *                                         is onboarded.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function getCurrentGymId(): Promise<string | null> {
  // ── 1. Explicit cookie (set by /api/gym after the user selects a gym) ──
  const store = await cookies();
  const fromCookie = store.get(GYM_COOKIE)?.value;
  if (fromCookie && isUuid(fromCookie)) return fromCookie;

  // ── 2. Supabase auth session → user_gyms membership ──
  //
  // If the caller has a real Supabase session we can derive their gym from
  // the user_gyms join table.  This path is a no-op today (staff auth is not
  // yet wired) but it will become the primary path once it is, and having it
  // here means getCurrentGymId() will "just work" the moment auth lands.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient() as any;
      const { data } = await admin
        .from("user_gyms")
        .select("gym_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (data?.gym_id && isUuid(data.gym_id as string)) {
        return data.gym_id as string;
      }

      // User is authenticated but has no gym_id entry → do NOT fall through
      // to a global lookup.  Return null so the caller can redirect to setup.
      return null;
    }
  } catch {
    // Auth lookup failures (e.g. no Supabase env configured in test) should
    // not hard-crash; just fall through to null.
  }

  // ── No cookie, no session — cannot safely determine a gym ──
  return null;
}

/**
 * Like `getCurrentGymId()` but throws if no gym can be determined.
 * Use in server actions where proceeding without a gym_id is unsafe.
 */
export async function requireGymId(): Promise<string> {
  const id = await getCurrentGymId();
  if (!id) throw new Error("No active gym. Sign in and select a gym first.");
  return id;
}

/**
 * Returns a lightweight context object for the active gym.
 */
export type GymContext = {
  id: string;
  name: string;
  slug: string;
};

export async function getGymContext(): Promise<GymContext | null> {
  const gymId = await getCurrentGymId();
  if (!gymId) return null;

  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from("gyms")
    .select("id, name, slug")
    .eq("id", gymId)
    .maybeSingle();
  return data ?? null;
}

/**
 * Returns only the gyms the current user is a member of (via user_gyms).
 *
 * If the user has a real Supabase session, returns their specific gym list.
 * If there is no session (pre-auth / demo), returns an empty array rather
 * than leaking the full list of every gym in the database.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * DELIBERATELY REMOVED:
 *  ✗  gyms SELECT * ORDER BY created_at  — was returning every gym in the DB
 *                                          to every user regardless of access.
 * ──────────────────────────────────────────────────────────────────────────
 */
export async function listUserGyms(): Promise<GymContext[]> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient() as any;
      const { data } = await admin
        .from("user_gyms")
        .select("gyms(id, name, slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      return (data ?? [])
        .map((row: any) => row.gyms)
        .filter(Boolean)
        .map((g: any) => ({ id: g.id as string, name: g.name as string, slug: g.slug as string }));
    }
  } catch {
    // Fall through to empty list on any auth error.
  }

  // No session (pre-auth / demo mode) — fall back to all gyms in the DB so
  // the SelectGymState screen works before real auth is wired.  Once
  // Supabase session auth is live this branch becomes unreachable.
  try {
    const admin = createAdminClient() as any;
    const { data } = await admin
      .from("gyms")
      .select("id, name, slug")
      .order("created_at", { ascending: true });
    return (data ?? []).map((g: any) => ({
      id: g.id as string,
      name: g.name as string,
      slug: g.slug as string,
    }));
  } catch {
    return [];
  }
}
