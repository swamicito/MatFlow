import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Award, Zap, Shield } from "lucide-react";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getStudentProgress } from "@/app/(dashboard)/students/gamification-actions";
import type { EarnedBadge } from "@/app/(dashboard)/students/gamification-actions";
import { getBadgeMeta } from "@/lib/portal-utils";
import { cn } from "@/lib/utils";
import type { ProgressSnapshot } from "@/lib/gamification";

export const dynamic = "force-dynamic";
export const metadata = { title: "Achievements · Portal" };

// ── Category config ────────────────────────────────────────────────────────────

const CATEGORY = {
  attendance: { label: "Attendance",    color: "#eab308", Icon: Award  },
  streak:     { label: "Consistency",   color: "#f97316", Icon: Zap    },
  belt:       { label: "Belt Rank",     color: "#3b82f6", Icon: Shield },
} as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function lockedProgress(badge: EarnedBadge, snap: ProgressSnapshot): { cur: number; target: number } {
  if (badge.key.startsWith("attendance_")) {
    const target = parseInt(badge.key.split("_")[1]!, 10);
    return { cur: snap.totalClasses, target };
  }
  if (badge.key.startsWith("streak_")) {
    const target = parseInt(badge.key.split("_")[1]!, 10);
    return { cur: snap.longestStreakWeeks, target };
  }
  return { cur: 0, target: 1 };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BadgesPage() {
  const identity = await getCurrentStudentIdentity();
  if (!identity) redirect("/login");

  const result = await getStudentProgress(identity.studentId);
  if (!result.ok) redirect("/portal");

  const { earnedBadges, lockedBadges, snapshot, nextMilestone } = result.data;
  const cats = ["attendance", "streak", "belt"] as const;

  return (
    <div className="space-y-8 pb-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 pt-1">
        <Link
          href="/portal"
          className="h-9 w-9 grid place-items-center rounded-full border border-[#222] bg-[#0a0a0a] text-[#888] hover:text-white hover:border-[#333] transition-colors active:scale-95 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Achievements</h1>
          <p className="text-xs text-[#555] mt-0.5">
            {earnedBadges.length} earned
            {lockedBadges.length > 0 && ` · ${lockedBadges.length} in progress`}
          </p>
        </div>
      </div>

      {/* ── Next milestone banner ── */}
      {nextMilestone && (
        <div className="rounded-2xl border border-yellow-500/25 bg-gradient-to-br from-yellow-500/10 to-transparent p-5 space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none">🎯</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">
                {nextMilestone.remaining} more class{nextMilestone.remaining !== 1 ? "es" : ""} to unlock
              </p>
              <p className="text-xs text-yellow-400/70 mt-1">
                {snapshot.totalClasses} / {nextMilestone.tier} toward the &quot;{nextMilestone.tier} Classes&quot; badge
              </p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-black/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-yellow-500 transition-all duration-700"
              style={{ width: `${Math.min((snapshot.totalClasses / nextMilestone.tier) * 100, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-yellow-600 uppercase tracking-widest">Keep going 💪</p>
        </div>
      )}

      {/* ── Streak progress (if locked streak badge exists) ── */}
      {(() => {
        const nextStreak = lockedBadges.find(b => b.key.startsWith("streak_"));
        if (!nextStreak) return null;
        const { cur, target } = lockedProgress(nextStreak, snapshot);
        const meta = getBadgeMeta(nextStreak.key);
        return (
          <div className="rounded-2xl border border-orange-500/20 bg-gradient-to-br from-orange-500/8 to-transparent p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none">{meta.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{meta.label}</p>
                <p className="text-xs text-orange-400/70 mt-1">{meta.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-white">{cur}<span className="text-xs text-[#444] font-normal">/{target}</span></p>
                <p className="text-[10px] text-[#555]">weeks</p>
              </div>
            </div>
            <div className="h-2 rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all duration-700"
                style={{ width: `${Math.min((cur / target) * 100, 100)}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* ── Empty state ── */}
      {earnedBadges.length === 0 && (
        <div className="py-14 flex flex-col items-center gap-5 text-center">
          <div className="h-24 w-24 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] grid place-items-center">
            <Award className="h-12 w-12 text-[#2a2a2a]" />
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-white">No badges yet</p>
            <p className="text-sm text-[#555] max-w-xs">
              Keep showing up. Your first badge is just a few classes away.
            </p>
          </div>
          <Link
            href="/portal/progress"
            className="text-xs text-[#666] hover:text-white border border-[#222] rounded-full px-4 py-2 transition-colors"
          >
            View my progress →
          </Link>
        </div>
      )}

      {/* ── Earned badges by category ── */}
      {earnedBadges.length > 0 && cats.map((cat) => {
        const inCat = earnedBadges.filter((b) => b.category === cat);
        if (inCat.length === 0) return null;
        const { label, color, Icon } = CATEGORY[cat];
        return (
          <section key={cat} className="space-y-3">
            <div className="flex items-center gap-2 px-0.5">
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
              <h2
                className="text-[11px] font-bold uppercase tracking-widest"
                style={{ color }}
              >
                {label}
              </h2>
              <div className="flex-1 h-px bg-[#111]" />
              <span className="text-[10px] text-[#444]">{inCat.length}</span>
            </div>

            <div className="space-y-2">
              {inCat.map((badge) => {
                const meta = getBadgeMeta(badge.key);
                return (
                  <div
                    key={badge.key}
                    className="flex items-center gap-4 rounded-2xl border border-[#1a1a1a] bg-[#0a0a0a] px-4 py-3.5"
                  >
                    {/* Badge icon */}
                    <div
                      className="h-13 w-13 shrink-0 rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] grid place-items-center text-[28px] leading-none"
                      style={{ minWidth: "3.25rem", minHeight: "3.25rem" }}
                    >
                      {meta.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug">{meta.label}</p>
                      <p className="text-xs text-[#555] mt-0.5 leading-snug">{meta.description}</p>
                    </div>

                    {/* Earned date */}
                    {badge.earned_at && (
                      <div className="text-right shrink-0">
                        <p className="text-[9px] text-[#3a3a3a] uppercase tracking-wider">Earned</p>
                        <p className="text-[11px] text-[#666] mt-0.5 whitespace-nowrap">
                          {fmtDate(badge.earned_at)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* ── Coming up (attendance only — belt is manual, streak shown above) ── */}
      {(() => {
        const upcoming = lockedBadges.filter((b) => b.key.startsWith("attendance_"));
        if (upcoming.length === 0) return null;
        return (
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-0.5">
              <div className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#333]" />
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#444]">Coming Up</h2>
              <div className="flex-1 h-px bg-[#111]" />
            </div>

            <div className="space-y-2">
              {upcoming.map((badge) => {
                const meta = getBadgeMeta(badge.key);
                const { cur, target } = lockedProgress(badge, snapshot);
                const pct = Math.min((cur / target) * 100, 100);
                const remaining = target - cur;
                return (
                  <div
                    key={badge.key}
                    className="rounded-2xl border border-[#0f0f0f] bg-[#060606] px-4 py-3.5 space-y-3"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="shrink-0 rounded-xl border border-[#111] bg-[#0a0a0a] grid place-items-center text-[28px] leading-none grayscale opacity-30"
                        style={{ minWidth: "3.25rem", minHeight: "3.25rem" }}
                      >
                        {meta.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#555]">{meta.label}</p>
                        <p className="text-xs text-[#333] mt-0.5">{meta.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-[#444]">
                          {cur}<span className="text-[#2a2a2a] text-xs font-normal">/{target}</span>
                        </p>
                        <p className="text-[10px] text-[#333]">classes</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="h-1.5 rounded-full bg-[#111] overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700",
                            pct > 0 ? "bg-[#2a2a2a]" : "bg-transparent",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[#2d2d2d]">
                        {remaining} more class{remaining !== 1 ? "es" : ""} to go
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* ── Footer hint ── */}
      <p className="text-center text-[10px] text-[#2d2d2d] pb-2">
        Badges are awarded automatically as you train.
      </p>

    </div>
  );
}
