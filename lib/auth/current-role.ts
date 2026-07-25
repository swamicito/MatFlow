import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { can, type Permission } from "@/lib/permissions";
import type { UserRole } from "@/lib/supabase/types";

const VALID_ROLES: UserRole[] = ["owner", "admin", "instructor", "front_desk"];

// Kept for the role-switcher UI in the topbar (display-only, not trusted for auth).
export const ROLE_COOKIE = "mf-role";

/**
 * Returns the active role for the current request.
 *
 * Derives the role from `user_gyms.role` — scoped to both the authenticated
 * Supabase user AND the verified current gym. Cookie is no longer trusted.
 * Fails closed to "front_desk" (lowest privilege) if anything goes wrong.
 */
export async function getCurrentRole(): Promise<UserRole> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "front_desk";

    const gymId = await getCurrentGymId();
    if (!gymId) return "front_desk";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any;
    const { data } = await admin
      .from("user_gyms")
      .select("role")
      .eq("user_id", user.id)
      .eq("gym_id", gymId)
      .maybeSingle();

    const raw = data?.role as string | undefined;
    if (raw && (VALID_ROLES as string[]).includes(raw)) return raw as UserRole;
  } catch {
    // Fall through to safe default on any error.
  }

  return "front_desk"; // fail-closed — never silently escalate to "owner"
}

export function isValidRole(value: string): value is UserRole {
  return (VALID_ROLES as string[]).includes(value);
}

/**
 * Server-action helper. Returns `{ ok: false }` with a friendly message when
 * the caller lacks the required permission so actions can early-return.
 */
export async function requirePermission(
  perm: Permission,
): Promise<{ ok: true; role: UserRole } | { ok: false; error: string }> {
  const role = await getCurrentRole();
  if (!can(role, perm)) {
    return {
      ok: false,
      error: `Your role doesn't allow this action (missing: ${perm}).`,
    };
  }
  return { ok: true, role };
}
