import { cookies } from "next/headers";

export const PLATFORM_ADMIN_COOKIE = "mf-pa";

/**
 * The secret is set via PLATFORM_ADMIN_SECRET env var.
 * Falls back to a dev-only default — override this in production.
 */
export function getPlatformAdminSecret(): string {
  return process.env.PLATFORM_ADMIN_SECRET ?? "matflow-admin-dev";
}

/**
 * Returns true when the current request carries the valid platform-admin cookie.
 * Safe to call from server components, server actions, and route handlers.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  try {
    const store = await cookies();
    const val = store.get(PLATFORM_ADMIN_COOKIE)?.value;
    const secret = getPlatformAdminSecret();
    return !!val && val === secret;
  } catch {
    return false;
  }
}
