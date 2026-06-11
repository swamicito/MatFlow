import { redirect } from "next/navigation";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getPortalDashboard } from "../actions";
import { AttendanceHeatmap } from "@/components/portal/attendance-heatmap";
import { BadgesRow } from "@/components/portal/badges-row";
import { BELT_COLORS, BELT_LABEL } from "@/lib/portal-utils";
import { Flame, Award, TrendingUp, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const identity = await getCurrentStudentIdentity();
  if (!identity) redirect("/login");

  const data = await getPortalDashboard(identity.studentId);
  if (!data) redirect("/login?error=no_student");

  const { stats, goal, beltProgress, badges, attendanceDays, student } = data;
  const belt = beltProgress?.current_belt ?? student.belt_rank;
  const weekProgress = Math.min(stats.thisWeekClasses / goal.weekly_target, 1);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My Progress</h1>

      {/* Streak cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn("rounded-xl border p-4 space-y-1", stats.currentStreak > 0 ? "border-white/20 bg-[#0f0f0f]" : "border-[#1a1a1a] bg-[#0a0a0a]")}>
          <div className="flex items-center gap-1.5 text-xs text-[#555]">
            <Flame className="h-3.5 w-3.5" /> Current Streak
          </div>
          <p className="text-4xl font-bold text-white">{stats.currentStreak}</p>
          <p className="text-xs text-[#444]">days</p>
        </div>
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#555]">
            <TrendingUp className="h-3.5 w-3.5" /> Best Streak
          </div>
          <p className="text-4xl font-bold text-white">{stats.longestStreak}</p>
          <p className="text-xs text-[#444]">days</p>
        </div>
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#555]">
            <Award className="h-3.5 w-3.5" /> Total Classes
          </div>
          <p className="text-4xl font-bold text-white">{stats.totalClasses}</p>
          <p className="text-xs text-[#444]">all time</p>
        </div>
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-[#555]">
            <Target className="h-3.5 w-3.5" /> This Week
          </div>
          <p className="text-4xl font-bold text-white">{stats.thisWeekClasses}</p>
          <p className="text-xs text-[#444]">of {goal.weekly_target} goal</p>
        </div>
      </div>

      {/* Weekly goal bar */}
      <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Weekly Goal</h2>
          <span className="text-xs text-[#555]">{Math.round(weekProgress * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#111] overflow-hidden">
          <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${weekProgress * 100}%` }} />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: goal.weekly_target }).map((_, i) => (
            <div key={i} className={cn("flex-1 h-1.5 rounded-full", i < stats.thisWeekClasses ? "bg-white" : "bg-[#1f1f1f]")} />
          ))}
        </div>
      </section>

      {/* Heat map */}
      <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
        <h2 className="text-sm font-medium">12-Week Attendance</h2>
        <AttendanceHeatmap days={attendanceDays} />
      </section>

      {/* Belt progress */}
      {beltProgress && (
        <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">Belt Progress</h2>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full border"
              style={{ color: BELT_COLORS[belt], borderColor: BELT_COLORS[belt] + "40" }}
            >
              {BELT_LABEL[belt]}
            </span>
          </div>
          <div className="h-3 rounded-full bg-[#111] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${beltProgress.progress_percentage}%`, backgroundColor: BELT_COLORS[belt] }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[#555]">
            <span>{beltProgress.progress_percentage}% complete</span>
            <span>{beltProgress.stripes} / 4 stripes</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {[0, 1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn("h-5 w-5 rounded-full border-2", s < beltProgress.stripes ? "bg-white border-white" : "bg-transparent border-[#333]")}
              />
            ))}
          </div>
        </section>
      )}

      {/* Badges */}
      <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Badges</h2>
          <span className="text-xs text-[#555]">{badges.length} earned</span>
        </div>
        {badges.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-3xl">🏅</p>
            <p className="text-sm text-[#555]">Keep training to earn badges!</p>
          </div>
        ) : (
          <BadgesRow badges={badges} />
        )}
      </section>
    </div>
  );
}
