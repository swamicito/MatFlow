import { cookies } from "next/headers";
import type { UserRole } from "@/lib/supabase/types";

const ROLE_COOKIE = "mf-role";
const VALID_ROLES: UserRole[] = ["owner", "admin", "instructor", "front_desk"];

/**
 * Returns the active role for the current request.
 *
 * MatFlow is currently single-tenant and ships without an auth provider, so
 * the role is selected from a signed-out role switcher in the topbar and
 * stored in the `mf-role` cookie. When real Supabase auth is wired in, swap
 * this implementation for `auth.getUser()` → `profiles.role`.
 */
export async function getCurrentRole(): Promise<UserRole> {
  const store = await cookies();
  const raw = store.get(ROLE_COOKIE)?.value;
  if (raw && (VALID_ROLES as string[]).includes(raw)) {
    return raw as UserRole;
  }
  return "owner";
}

export function isValidRole(value: string): value is UserRole {
  return (VALID_ROLES as string[]).includes(value);
}

export { ROLE_COOKIE };

/**
 * Server-action helper. Returns `{ ok: false }` with a friendly message when
 * the caller lacks the required permission so actions can early-return.
 */
import { can, type Permission } from "@/lib/permissions";

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
