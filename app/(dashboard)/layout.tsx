/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRole } from "@/lib/auth/current-role";
import { getCurrentGymId, listUserGyms, type GymContext } from "@/lib/auth/current-gym";
import { GymSelectButton } from "@/components/layout/gym-select-button";

// Accepts an already-resolved gymId so we never call getCurrentGymId() twice.
async function isOnboardingComplete(gymId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient() as any;
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

// Shown when the user has no gym access at all (not in user_gyms, no cookie).
function NoGymState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="h-16 w-16 rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] grid place-items-center mx-auto mb-6">
          <Building2 className="h-7 w-7 text-[#444]" />
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">No gym configured</h1>
        <p className="text-[#666] text-sm leading-relaxed mb-8">
          Your account is not linked to any gym. Contact your administrator,
          or create a gym to get started.
        </p>
        <Link
          href="/settings/gym"
          className="inline-flex h-10 items-center gap-2 px-5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
        >
          Set up a gym
        </Link>
      </div>
    </div>
  );
}

// Shown when the user has gym memberships but no active gym cookie is set.
function SelectGymState({ gyms }: { gyms: GymContext[] }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <div className="h-16 w-16 rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] grid place-items-center mx-auto mb-6">
            <Building2 className="h-7 w-7 text-[#444]" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Select a gym</h1>
          <p className="text-[#666] text-sm">
            You have access to {gyms.length} gym{gyms.length !== 1 ? "s" : ""}.
            Choose one to continue.
          </p>
        </div>
        <div className="space-y-2">
          {gyms.map((gym) => (
            <GymSelectButton key={gym.id} gym={gym} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Resolve all context in one parallel fetch.
  // getCurrentGymId() is called exactly once — the result is shared with
  // isOnboardingComplete() and Topbar, eliminating the previous double-call.
  const [role, gyms, gymId] = await Promise.all([
    getCurrentRole(),
    listUserGyms(),
    getCurrentGymId(),
  ]);

  // ── No active gym ──────────────────────────────────────────────────────────
  if (!gymId) {
    // Authenticated user with gym memberships but no active selection.
    if (gyms.length > 0) {
      return <SelectGymState gyms={gyms} />;
    }
    // No gym access at all.
    return <NoGymState />;
  }

  // ── Onboarding gate ────────────────────────────────────────────────────────
  if (!(await isOnboardingComplete(gymId))) {
    redirect("/onboarding");
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar role={role} gyms={gyms} activeGymId={gymId} />
        <main className="flex-1 p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
