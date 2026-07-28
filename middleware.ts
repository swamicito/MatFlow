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

function loginRedirect(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", req.nextUrl.pathname);
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const isPortal = PORTAL_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!isProtected && !isPortal) {
    return NextResponse.next();
  }

  // Wrap in try/catch so that any unexpected error (Supabase network failure,
  // missing env vars, edge runtime quirk) fails CLOSED — protected routes
  // redirect to login rather than serving the page unprotected.
  let user: import("@supabase/supabase-js").User | null = null;
  let sessionResponse: NextResponse;

  try {
    const result = await updateSession(req);
    user = result.user;
    sessionResponse = result.response;
  } catch {
    // updateSession itself threw — fail closed.
    if (isProtected) return loginRedirect(req);
    return NextResponse.next();
  }

  // Primary auth gate: unauthenticated visitors on staff routes → /login
  if (!user && isProtected) {
    return loginRedirect(req);
  }

  // Prevent edge/CDN from caching authenticated staff pages.
  if (isProtected) {
    sessionResponse.headers.set("Cache-Control", "no-store");
  }

  return sessionResponse;
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
