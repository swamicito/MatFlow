import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listInstructionals, getOnDemandStats } from "./actions";
import { OnDemandAdmin } from "@/components/ondemand/ondemand-admin";

export const dynamic = "force-dynamic";

export default async function OnDemandPage() {
  const [instRes, statsRes] = await Promise.all([
    listInstructionals(false),
    getOnDemandStats(),
  ]);

  if (!instRes.ok) {
    const isMissing =
      instRes.error.includes("instructionals") ||
      instRes.error.includes("relation");
    return (
      <div className="space-y-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {isMissing ? (
            <>
              On-demand tables are missing. Apply{" "}
              <code className="text-white">
                supabase/migrations/0009_ondemand.sql
              </code>{" "}
              and reload.
            </>
          ) : (
            instRes.error
          )}
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

      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          On-Demand Instructionals
        </h1>
        <p className="text-sm text-[#aaa] mt-1">
          Upload video lessons — link a YouTube/Vimeo URL or a direct file URL.
          Set price, category, and visibility. Students purchase and watch from
          their profile.
        </p>
      </header>

      <OnDemandAdmin
        initialVideos={instRes.data}
        stats={statsRes.ok ? statsRes.data : null}
      />
    </div>
  );
}
