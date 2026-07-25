import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentGymId } from "@/lib/auth/current-gym";

/**
 * Requires a valid Supabase session AND an active gym membership.
 * /frontdesk is a standalone kiosk route (outside the dashboard layout group)
 * so it needs its own auth gate — it's also covered by the middleware matcher.
 */
export default async function FrontdeskLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/frontdesk");

  const gymId = await getCurrentGymId();
  if (!gymId) redirect("/dashboard");

  return <>{children}</>;
}
