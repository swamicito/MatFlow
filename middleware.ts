import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes that require a valid Supabase session (staff-only).
// Unauthenticated visitors are redirected to /login?next=<path>.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/leads",
  "/students",
  "/billing",
  "/reports",
  "/schedule",
  "/settings",
  "/checkin",
  "/messages",
  "/frontdesk",
];

const PORTAL_PREFIXES = ["/portal", "/login", "/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isPortal = PORTAL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtected || isPortal) {
    const { response, user } = await updateSession(req);

    // Primary auth gate: unauthenticated visitors on staff routes → /login
    if (!user && isProtected) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/leads",
    "/leads/:path*",
    "/students",
    "/students/:path*",
    "/billing",
    "/billing/:path*",
    "/reports",
    "/reports/:path*",
    "/schedule",
    "/schedule/:path*",
    "/settings",
    "/settings/:path*",
    "/checkin",
    "/checkin/:path*",
    "/messages",
    "/messages/:path*",
    "/frontdesk",
    "/frontdesk/:path*",
    "/portal",
    "/portal/:path*",
    "/login",
    "/auth/:path*",
  ],
};
