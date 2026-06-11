import { NextResponse, type NextRequest } from "next/server";
import {
  ROUTE_PERMISSIONS,
  can,
  type Permission,
} from "@/lib/permissions";
import type { UserRole } from "@/lib/supabase/types";
import { updateSession } from "@/lib/supabase/middleware";

const ROLE_COOKIE = "mf-role";
const VALID_ROLES: UserRole[] = ["owner", "admin", "instructor", "front_desk"];

// Routes that need Supabase session refresh but no dashboard role check
const PORTAL_PREFIXES = ["/portal", "/login", "/auth"];

function permissionForPath(pathname: string): Permission | null {
  const sorted = [...ROUTE_PERMISSIONS].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );
  for (const { prefix, perm } of sorted) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return perm;
    }
  }
  return null;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Portal / auth routes only need session refresh
  if (PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return updateSession(req);
  }

  // Dashboard routes: role-based permission check (no session refresh needed)
  const raw = req.cookies.get(ROLE_COOKIE)?.value;
  const role: UserRole =
    raw && (VALID_ROLES as string[]).includes(raw)
      ? (raw as UserRole)
      : "owner";

  const required = permissionForPath(pathname);
  if (required && !can(role, required)) {
    const url = req.nextUrl.clone();
    url.pathname = "/403";
    url.search = `?from=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/leads/:path*",
    "/students/:path*",
    "/billing/:path*",
    "/reports/:path*",
    "/schedule/:path*",
    "/settings/:path*",
    "/checkin/:path*",
    "/portal/:path*",
    "/portal",
    "/login",
    "/auth/:path*",
  ],
};
