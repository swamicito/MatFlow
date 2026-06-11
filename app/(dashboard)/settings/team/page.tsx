import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { listTeam } from "@/app/(dashboard)/settings/team/actions";
import { getCurrentRole } from "@/lib/auth/current-role";
import { TeamClient } from "@/components/team/team-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team & Roles · MatFlow" };

export default async function TeamPage() {
  const role = await getCurrentRole();
  const result = await listTeam();

  if (!result.ok) {
    return (
      <div className="space-y-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Team & Roles
        </h1>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3 text-sm text-amber-200">
          <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Couldn&apos;t load team members.</p>
            <p className="text-amber-200/80 mt-1">{result.error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>
      <TeamClient initialMembers={result.members} currentRole={role} />
    </div>
  );
}
