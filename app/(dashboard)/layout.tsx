/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRole } from "@/lib/auth/current-role";
import { getCurrentGymId, listUserGyms } from "@/lib/auth/current-gym";

async function isOnboardingComplete(): Promise<boolean> {
  try {
    const supabase = createAdminClient() as any;
    const gymId = await getCurrentGymId();
    if (!gymId) return false;
    const { data } = await supabase
      .from("gyms")
      .select("onboarding_completed")
      .eq("id", gymId)
      .maybeSingle();
    if (!data) return true;
    return Boolean(data.onboarding_completed);
  } catch {
    return true;
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await isOnboardingComplete())) {
    redirect("/onboarding");
  }

  const [role, gyms, activeGymId] = await Promise.all([
    getCurrentRole(),
    listUserGyms(),
    getCurrentGymId(),
  ]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar role={role} gyms={gyms} activeGymId={activeGymId} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
