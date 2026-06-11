"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  CalendarCheck,
  Flame,
  Lock,
  Trophy,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  getStudentProgress,
  setWeeklyGoal,
  joinChallenge,
  leaveChallenge,
  type StudentProgress,
} from "@/app/(dashboard)/students/gamification-actions";
import { WEEKLY_TARGET_OPTIONS } from "@/lib/gamification";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function StudentProgressSection({
  studentId,
  enabled,
}: {
  studentId: string;
  /** Stay collapsed / unmounted while the dialog is hidden. */
  enabled: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<StudentProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confettiKey, setConfettiKey] = useState(0);

  useEffect(() => {
    if (!enabled || !studentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStudentProgress(studentId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setData(res.data);
      if (res.data.newlyEarnedKeys.length > 0) {
        setConfettiKey((k) => k + 1);
        const first = res.data.earnedBadges.find(
          (b) => b.key === res.data.newlyEarnedKeys[0],
        );
        toast.success(
          first
            ? `New badge unlocked: ${first.label}`
            : `${res.data.newlyEarnedKeys.length} new badge${res.data.newlyEarnedKeys.length > 1 ? "s" : ""} unlocked`,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, enabled]);

  function changeGoal(target: number) {
    startTransition(async () => {
      const res = await setWeeklyGoal(studentId, target);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const refresh = await getStudentProgress(studentId);
      if (refresh.ok) setData(refresh.data);
      router.refresh();
    });
  }

  function toggleChallenge(challengeId: string, joined: boolean) {
    startTransition(async () => {
      const res = joined
        ? await leaveChallenge(challengeId, studentId)
        : await joinChallenge(challengeId, studentId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const refresh = await getStudentProgress(studentId);
      if (refresh.ok) setData(refresh.data);
    });
  }

  if (!enabled) return null;

  return (
    <section className="space-y-4 relative">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[#888]">Progress</h3>
        {data && (
          <span className="text-[10px] uppercase tracking-widest text-[#666]">
            Last 12 weeks
          </span>
        )}
      </div>

      {loading && !data ? (
        <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 text-sm text-[#666]">
          Loading progress…
        </div>
      ) : error ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error.includes("student_goals") || error.includes("student_badges") || error.includes("challenges") ? (
            <>
              Gamification tables are missing. Apply{" "}
              <code className="text-white">supabase/migrations/0007_gamification.sql</code>{" "}
              and reload.
            </>
          ) : (
            error
          )}
        </div>
      ) : data ? (
        <div className="space-y-4">
          {confettiKey > 0 && <ConfettiBurst key={confettiKey} />}
          <GoalCard
            target={data.snapshot.weeklyTarget}
            current={data.snapshot.currentWeekCount}
            streak={data.snapshot.streakWeeks}
            longest={data.snapshot.longestStreakWeeks}
            totalClasses={data.snapshot.totalClasses}
            disabled={pending}
            onChangeTarget={changeGoal}
          />
          <Heatmap weeks={data.snapshot.weeks} target={data.snapshot.weeklyTarget} />
          <BadgeGrid
            earned={data.earnedBadges}
            locked={data.lockedBadges}
            newlyEarnedKeys={data.newlyEarnedKeys}
            nextMilestone={data.nextMilestone}
            totalClasses={data.snapshot.totalClasses}
          />
          <ChallengesList
            challenges={data.challenges}
            disabled={pending}
            onToggle={toggleChallenge}
          />
        </div>
      ) : null}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal + streak card
// ─────────────────────────────────────────────────────────────────────────────

function GoalCard({
  target,
  current,
  streak,
  longest,
  totalClasses,
  disabled,
  onChangeTarget,
}: {
  target: number;
  current: number;
  streak: number;
  longest: number;
  totalClasses: number;
  disabled: boolean;
  onChangeTarget: (n: number) => void;
}) {
  const pct = Math.min(100, Math.round((current / Math.max(1, target)) * 100));
  const hit = current >= target;
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat
          icon={<Target className="h-4 w-4" />}
          label="This week"
          value={`${current} / ${target}`}
          accent={hit ? "text-emerald-300" : "text-white"}
        />
        <Stat
          icon={<Flame className="h-4 w-4" />}
          label="Current streak"
          value={`${streak}w`}
          hint={longest > streak ? `best ${longest}w` : undefined}
        />
        <Stat
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Total classes"
          value={String(totalClasses)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[#888] uppercase tracking-wider">
            Weekly goal
          </span>
          <span className="text-xs tabular-nums text-[#aaa]">{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#111] overflow-hidden border border-[#1f1f1f]">
          <div
            className={cn(
              "h-full transition-all",
              hit ? "bg-emerald-400" : "bg-white",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-[#888] mr-1">Set goal:</span>
        {WEEKLY_TARGET_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChangeTarget(n)}
            className={cn(
              "h-8 px-3 rounded-md border text-sm transition-colors disabled:opacity-50",
              n === target
                ? "border-white bg-white text-black"
                : "border-[#222] bg-black text-[#bbb] hover:bg-[#111] hover:text-white",
            )}
          >
            {n}× / week
          </button>
        ))}
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-3">
      <div className="flex items-center gap-2 text-[#888] text-[11px] uppercase tracking-widest">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          accent ?? "text-white",
        )}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-[#666]">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Heatmap
// ─────────────────────────────────────────────────────────────────────────────

function Heatmap({
  weeks,
  target,
}: {
  weeks: { weekStart: string; days: { date: string; count: number }[]; classCount: number; hitGoal: boolean }[];
  target: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#888] uppercase tracking-wider">
          Attendance
        </span>
        <Legend />
      </div>
      <div className="flex gap-3 overflow-x-auto">
        <div className="flex flex-col gap-1 pt-5 text-[10px] text-[#555]">
          {DAY_LABELS.map((d, i) => (
            <span key={i} className="h-3 leading-none">
              {d}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {weeks.map((w) => (
            <div key={w.weekStart} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "h-4 leading-none text-[9px] tabular-nums",
                  w.hitGoal ? "text-emerald-300" : "text-[#444]",
                )}
                title={`Week of ${w.weekStart} · ${w.classCount}/${target}`}
              >
                {w.classCount}
              </span>
              <div className="flex flex-col gap-1">
                {w.days.map((d) => {
                  const isFuture = d.date > today;
                  return (
                    <div
                      key={d.date}
                      title={`${d.date} · ${d.count} class${d.count === 1 ? "" : "es"}`}
                      className={cn(
                        "h-3 w-3 rounded-[2px] border",
                        isFuture
                          ? "border-[#1a1a1a] bg-transparent"
                          : d.count >= 2
                            ? "border-emerald-300 bg-emerald-300"
                            : d.count === 1
                              ? "border-white/70 bg-white/70"
                              : "border-[#1f1f1f] bg-[#0e0e0e]",
                      )}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-[#666]">
      <span>Less</span>
      <div className="h-3 w-3 rounded-[2px] border border-[#1f1f1f] bg-[#0e0e0e]" />
      <div className="h-3 w-3 rounded-[2px] border border-white/70 bg-white/70" />
      <div className="h-3 w-3 rounded-[2px] border border-emerald-300 bg-emerald-300" />
      <span>More</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

function BadgeGrid({
  earned,
  locked,
  newlyEarnedKeys,
  nextMilestone,
  totalClasses,
}: {
  earned: { key: string; label: string; description: string; category: string; earned_at: string | null }[];
  locked: { key: string; label: string; description: string; category: string }[];
  newlyEarnedKeys: string[];
  nextMilestone: { tier: number; remaining: number } | null;
  totalClasses: number;
}) {
  const newSet = new Set(newlyEarnedKeys);
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#888] uppercase tracking-wider">
          Badges
        </span>
        <span className="text-[10px] text-[#666] tabular-nums">
          {earned.length} earned
        </span>
      </div>

      {nextMilestone && (
        <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-3 flex items-center gap-3">
          <Trophy className="h-4 w-4 text-amber-300" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white">
              {nextMilestone.remaining} more class
              {nextMilestone.remaining === 1 ? "" : "es"} until{" "}
              <span className="font-medium">{nextMilestone.tier}-class badge</span>
            </p>
            <div className="mt-1 h-1.5 rounded-full bg-[#111] overflow-hidden">
              <div
                className="h-full bg-amber-300"
                style={{
                  width: `${Math.min(100, Math.round((totalClasses / nextMilestone.tier) * 100))}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {earned.length === 0 && locked.length === 0 ? (
          <div className="col-span-full text-sm text-[#666]">No badges yet.</div>
        ) : null}
        {earned.map((b) => (
          <BadgeTile
            key={b.key}
            label={b.label}
            description={b.description}
            earned
            isNew={newSet.has(b.key)}
            earnedAt={b.earned_at}
          />
        ))}
        {locked.map((b) => (
          <BadgeTile
            key={b.key}
            label={b.label}
            description={b.description}
            earned={false}
          />
        ))}
      </div>
    </div>
  );
}

function BadgeTile({
  label,
  description,
  earned,
  isNew,
  earnedAt,
}: {
  label: string;
  description: string;
  earned: boolean;
  isNew?: boolean;
  earnedAt?: string | null;
}) {
  return (
    <div
      title={description}
      className={cn(
        "relative rounded-md border p-3 text-sm transition-colors",
        earned
          ? "border-white/40 bg-white/5 text-white"
          : "border-[#1f1f1f] bg-[#0a0a0a] text-[#666]",
        isNew && "ring-1 ring-emerald-300 animate-pulse",
      )}
    >
      <div className="flex items-center gap-2">
        {earned ? (
          <Award
            className={cn(
              "h-4 w-4",
              isNew ? "text-emerald-300" : "text-white",
            )}
          />
        ) : (
          <Lock className="h-4 w-4" />
        )}
        <span className="font-medium truncate">{label}</span>
      </div>
      {earned && earnedAt && (
        <div className="text-[10px] text-[#888] mt-1 tabular-nums">
          Earned {new Date(earnedAt).toLocaleDateString()}
        </div>
      )}
      {isNew && (
        <span className="absolute -top-1 -right-1 inline-flex items-center rounded-full bg-emerald-300 text-black text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5">
          New
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Challenges
// ─────────────────────────────────────────────────────────────────────────────

function ChallengesList({
  challenges,
  disabled,
  onToggle,
}: {
  challenges: {
    id: string;
    title: string;
    description: string | null;
    target_classes: number;
    start_date: string;
    end_date: string;
    joined: boolean;
    classes_during_window: number;
    completed: boolean;
  }[];
  disabled: boolean;
  onToggle: (id: string, joined: boolean) => void;
}) {
  if (challenges.length === 0) return null;
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#888] uppercase tracking-wider">
          Active challenges
        </span>
      </div>
      <div className="space-y-2">
        {challenges.map((c) => {
          const pct = Math.min(
            100,
            Math.round((c.classes_during_window / c.target_classes) * 100),
          );
          return (
            <div
              key={c.id}
              className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-white font-medium">{c.title}</p>
                  {c.description && (
                    <p className="text-xs text-[#888] mt-0.5">{c.description}</p>
                  )}
                  <p className="text-[10px] text-[#666] mt-1 tabular-nums">
                    {c.start_date} → {c.end_date} · target {c.target_classes}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onToggle(c.id, c.joined)}
                  className={cn(
                    "border-[#333] bg-transparent text-white",
                    c.joined ? "hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40" : "hover:bg-[#111]",
                  )}
                >
                  {c.joined ? "Leave" : "Join"}
                </Button>
              </div>
              {c.joined && (
                <div>
                  <div className="flex items-center justify-between text-[10px] tabular-nums">
                    <span className={cn(c.completed ? "text-emerald-300" : "text-[#888]")}>
                      {c.classes_during_window} / {c.target_classes}
                    </span>
                    <span className="text-[#666]">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#111] overflow-hidden mt-1">
                    <div
                      className={cn(
                        "h-full",
                        c.completed ? "bg-emerald-300" : "bg-white",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Confetti — pure CSS, no dep
// ─────────────────────────────────────────────────────────────────────────────

function ConfettiBurst() {
  const pieces = Array.from({ length: 24 });
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.4;
        const duration = 1.4 + Math.random() * 0.8;
        const rotate = Math.random() * 360;
        const isDark = i % 2 === 0;
        return (
          <span
            key={i}
            className="absolute top-0 h-2 w-2 rounded-sm"
            style={{
              left: `${left}%`,
              backgroundColor: isDark ? "#fff" : "#34d399",
              transform: `rotate(${rotate}deg)`,
              animation: `mf-confetti ${duration}s ease-in ${delay}s forwards`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes mf-confetti {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(360px) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
