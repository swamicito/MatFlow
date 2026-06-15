import Link from "next/link";
import { Building2, Plus, CheckCircle2, AlertTriangle } from "lucide-react";
import { listAllGyms } from "@/app/admin/actions";
import { GymEnterButton } from "@/components/admin/gym-enter-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "All Gyms · Platform Admin" };

export default async function AdminGymsPage() {
  const gyms = await listAllGyms();

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">All Gyms</h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            {gyms.length} gym{gyms.length !== 1 ? "s" : ""} in the system
          </p>
        </div>
        <Link
          href="/admin/gyms/new"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          New Gym
        </Link>
      </div>

      {/* Gym list */}
      {gyms.length === 0 ? (
        <div className="border border-[#1a1a1a] rounded-2xl py-20 flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] grid place-items-center">
            <Building2 className="h-6 w-6 text-[#6B7280]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#888]">No gyms yet</p>
            <p className="text-xs text-[#9CA3AF] mt-1">Create one to get started.</p>
          </div>
          <Link
            href="/admin/gyms/new"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-white border border-[#222] rounded-xl px-4 py-2 hover:bg-[#0a0a0a] transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create first gym
          </Link>
        </div>
      ) : (
        <div className="border border-[#1a1a1a] rounded-2xl overflow-hidden divide-y divide-[#111]">
          {gyms.map((gym) => (
            <div
              key={gym.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-[#050505] transition-colors group"
            >
              <div className="h-9 w-9 rounded-lg border border-[#1a1a1a] bg-[#0a0a0a] grid place-items-center shrink-0">
                <Building2 className="h-4 w-4 text-[#9CA3AF]" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{gym.name}</p>
                <p className="text-xs text-[#9CA3AF] font-mono mt-0.5">{gym.slug}</p>
              </div>

              {/* Meta */}
              <div className="hidden md:flex items-center gap-4 shrink-0 text-[11px]">
                <span className="text-[#9CA3AF]">{gym.timezone}</span>
                <span className="text-[#6B7280]">
                  {new Date(gym.created_at).toLocaleDateString("en-US", {
                    month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
                {gym.onboarding_completed ? (
                  <span className="flex items-center gap-1 text-emerald-500/80">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-500/80">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Setup
                  </span>
                )}
              </div>

              <GymEnterButton gymId={gym.id} />
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
