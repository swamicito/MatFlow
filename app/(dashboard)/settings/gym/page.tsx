/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import { GymManagementClient } from "@/components/gym/gym-management-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage Gyms · MatFlow" };

export default async function GymManagementPage() {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) redirect("/settings");

  const supabase = createAdminClient() as any;
  const activeGymId = await getCurrentGymId();

  const [gymsRes, activeGymRes] = await Promise.all([
    supabase
      .from("gyms")
      .select("id, name, slug, created_at, onboarding_completed")
      .order("created_at", { ascending: true }),
    activeGymId
      ? supabase
          .from("gyms")
          .select("id, free_class_nudge_after")
          .eq("id", activeGymId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>
      <GymManagementClient
        gyms={gymsRes.data ?? []}
        activeGymId={activeGymId}
        activeGymSettings={activeGymRes.data ?? null}
      />
    </div>
  );
}
