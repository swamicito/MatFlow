/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const GYM_COOKIE = "mf-gym-id";
const FALLBACK_SLUG = "asbury-park";

export { GYM_COOKIE };

/**
 * Returns the active gym_id for the current request.
 *
 * Resolution order:
 *  1. `mf-gym-id` cookie  (set by /api/gym when user switches gyms)
 *  2. ASBURY_PARK_GYM_ID  env var  (local dev / single-tenant convenience)
 *  3. First gym with slug `asbury-park`  (legacy seed)
 *  4. First row in the gyms table        (last-resort fallback)
 *
 * Returns `null` if no gym exists at all (empty DB / pre-onboarding).
 */
export async function getCurrentGymId(): Promise<string | null> {
  // 1. Cookie
  const store = await cookies();
  const fromCookie = store.get(GYM_COOKIE)?.value;
  if (fromCookie && fromCookie.length === 36) return fromCookie;

  // 2. Env var
  const fromEnv = process.env.ASBURY_PARK_GYM_ID;
  if (fromEnv) return fromEnv;

  // 3 & 4. DB lookup
  const supabase = createAdminClient() as any;
  const { data: bySlug } = await supabase
    .from("gyms")
    .select("id")
    .eq("slug", FALLBACK_SLUG)
    .maybeSingle();
  if (bySlug?.id) return bySlug.id;

  const { data: first } = await supabase
    .from("gyms")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return first?.id ?? null;
}

/**
 * Like `getCurrentGymId()` but throws if no gym is found.
 * Use in server actions where a gym_id is mandatory.
 */
export async function requireGymId(): Promise<string> {
  const id = await getCurrentGymId();
  if (!id) throw new Error("No active gym. Complete onboarding first.");
  return id;
}

/**
 * Returns a lightweight context object with the active gym_id and its name.
 * Useful for rendering the gym switcher and page headers.
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
 * Returns all gyms accessible to a given user_id via the user_gyms table,
 * or falls back to all gyms in the system (for pre-auth single-tenant mode).
 */
export async function listUserGyms(): Promise<GymContext[]> {
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from("gyms")
    .select("id, name, slug")
    .order("created_at", { ascending: true });
  return (data ?? []).map((g: any) => ({ id: g.id, name: g.name, slug: g.slug }));
}
