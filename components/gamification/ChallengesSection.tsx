import { Trophy, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChallengeType, ChallengeWithProgress } from "@/lib/gamification/challenges";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeIcon(t: ChallengeType): string {
  switch (t) {
    case "class_count":   return "🎯";
    case "streak":        return "🔥";
    case "points_earned": return "⚡";
  }
}

/** Progress label that makes the unit clear — especially for points_earned. */
function progressLabel(ch: ChallengeWithProgress): string {
  const p = ch.progress.toLocaleString();
  const g = ch.goal_value.toLocaleString();
  switch (ch.challenge_type) {
    case "class_count":   return `${p} / ${g} classes`;
    case "streak":        return `${p} / ${g} day streak`;
    case "points_earned": return `${p} / ${g} pts (this window)`;
  }
}

/** Days-left chip: color shifts amber → red as deadline approaches. */
function daysChip(days: number): { label: string; cls: string } {
  if (days === 0) return {
    label: "Last day!",
    cls:   "bg-red-500/15 text-red-400 border-red-500/30",
  };
  if (days <= 3) return {
    label: `${days}d left`,
    cls:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };
  if (days <= 7) return {
    label: `${days}d left`,
    cls:   "bg-yellow-500/10 text-yellow-400/80 border-yellow-500/20",
  };
  return {
    label: `${days}d left`,
    cls:   "bg-[#111] text-[#555] border-[#222]",
  };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** True if completed within the last 24 hours (server render time). */
function isJustEarned(completedAt: string | null): boolean {
  if (!completedAt) return false;
  return Date.now() - new Date(completedAt).getTime() < 24 * 60 * 60 * 1000;
}

// ─── Active challenge card ────────────────────────────────────────────────────

function ActiveCard({ ch }: { ch: ChallengeWithProgress }) {
  const chip = daysChip(ch.days_left);

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{typeIcon(ch.challenge_type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white leading-snug">{ch.title}</p>
            <span className="shrink-0 text-[11px] font-bold text-white bg-[#1a1a1a] border border-[#252525] rounded-full px-2.5 py-0.5 whitespace-nowrap">
              +{ch.points_reward} pts
            </span>
          </div>
          {ch.description && (
            <p className="text-[11px] text-[#555] mt-0.5 leading-snug">{ch.description}</p>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="h-2.5 rounded-full bg-[#111] overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${ch.progress_pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-[#555]">{progressLabel(ch)}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-[#444]">{ch.progress_pct}%</span>
            <span className={cn(
              "text-[10px] font-semibold border rounded-full px-2 py-0.5 whitespace-nowrap",
              chip.cls,
            )}>
              {chip.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Completed challenge card ─────────────────────────────────────────────────

function CompletedCard({ ch }: { ch: ChallengeWithProgress }) {
  const fresh = isJustEarned(ch.completed_at);

  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-2.5",
      fresh
        ? "border-emerald-400/40 bg-emerald-500/[0.08]"
        : "border-emerald-500/30 bg-emerald-500/[0.06]",
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{typeIcon(ch.challenge_type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-emerald-400 leading-snug">
              {ch.title}
            </p>
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {fresh && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-full px-2 py-0.5">
                🎉 Just earned!
              </span>
            )}
            <span className="text-[11px] text-emerald-500/70 font-medium">
              +{ch.points_reward} pts earned
            </span>
          </div>
          {ch.completed_at && (
            <p className="text-[10px] text-emerald-700 mt-0.5">
              Completed on {fmtDate(ch.completed_at)}
            </p>
          )}
        </div>
      </div>

      {/* Full 100 % bar */}
      <div className="h-1.5 rounded-full bg-emerald-900/40 overflow-hidden">
        <div className="h-full w-full rounded-full bg-emerald-500/60" />
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

type Props = {
  challenges: ChallengeWithProgress[];
};

export function ChallengesSection({ challenges }: Props) {
  const active    = challenges.filter((c) => !c.completed);
  const completed = challenges.filter((c) =>  c.completed);
  const hasBoth   = active.length > 0 && completed.length > 0;

  if (active.length === 0 && completed.length === 0) {
    return (
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-6 text-center space-y-2">
        <Trophy className="h-6 w-6 text-[#333] mx-auto" />
        <p className="text-sm text-[#555]">No active challenges right now.</p>
        <p className="text-[11px] text-[#333]">
          New challenges are set by your gym — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Active */}
      {active.length > 0 && (
        <div className="space-y-3">
          {hasBoth && (
            <p className="text-[10px] font-semibold text-[#444] uppercase tracking-wider">
              In Progress — {active.length}
            </p>
          )}
          {active.map((ch) => <ActiveCard key={ch.id} ch={ch} />)}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-3">
          {hasBoth && (
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
              Completed — {completed.length}
            </p>
          )}
          {completed.map((ch) => <CompletedCard key={ch.id} ch={ch} />)}
        </div>
      )}
    </div>
  );
}
