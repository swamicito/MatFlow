import { cookies } from "next/headers";

export const PLATFORM_ADMIN_COOKIE = "mf-pa";

const DEFAULT_SECRET = "matflow-admin-dev";

/**
 * The secret is set via PLATFORM_ADMIN_SECRET env var.
 * Falls back to a dev-only default — MUST be overridden in production.
 */
export function getPlatformAdminSecret(): string {
  return process.env.PLATFORM_ADMIN_SECRET ?? DEFAULT_SECRET;
}

/**
 * Returns true when the current request carries the valid platform-admin cookie.
 * Safe to call from server components, server actions, and route handlers.
 *
 * SECURITY: Returns false (and logs an error) in production when
 * PLATFORM_ADMIN_SECRET has not been set, preventing access via the
 * publicly-known default secret.
 */
export async function isPlatformAdmin(): Promise<boolean> {
  try {
    const secret = getPlatformAdminSecret();

    if (process.env.NODE_ENV === "production" && secret === DEFAULT_SECRET) {
      console.error(
        "[platform-admin] PLATFORM_ADMIN_SECRET is not set. " +
        "Platform admin access is disabled until the secret is configured " +
        "in your environment variables.",
      );
      return false;
    }

    const store = await cookies();
    const val = store.get(PLATFORM_ADMIN_COOKIE)?.value;
    return !!val && val === secret;
  } catch {
    return false;
  }
}
