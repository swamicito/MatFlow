import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Refreshes the Supabase auth session on each request and returns both the
 * updated response and the authenticated user (or null).
 *
 * The root `middleware.ts` uses the returned `user` to gate staff routes
 * without a second `getUser()` round-trip.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Fail closed: if getUser() throws for any reason (network error, bad env
  // vars, Supabase timeout), return user: null so the middleware gate can
  // still redirect to login rather than crashing and falling through unprotected.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return { response, user };
  } catch {
    return { response, user: null };
  }
}
