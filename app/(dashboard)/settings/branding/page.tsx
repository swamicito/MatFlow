/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import { BrandingClient } from "@/components/branding/branding-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Custom Branding · MatFlow" };

export default async function BrandingPage() {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) redirect("/settings");

  const gymId = await getCurrentGymId();
  const supabase = createAdminClient() as any;

  const { data: gym } = gymId
    ? await supabase
        .from("gyms")
        .select("id, name, logo_url, logo_bg_color, primary_color, secondary_color, accent_color")
        .eq("id", gymId)
        .maybeSingle()
    : { data: null };

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <BrandingClient
        gymName={gym?.name ?? "Your Gym"}
        initialLogoUrl={gym?.logo_url ?? null}
        initialPrimaryColor={gym?.primary_color ?? "#ffffff"}
        initialSecondaryColor={gym?.secondary_color ?? "#000000"}
        initialAccentColor={gym?.accent_color ?? "#666666"}
        initialLogoBgColor={gym?.logo_bg_color ?? "#111111"}
      />
    </div>
  );
}
