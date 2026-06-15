"use client";

import type { PortalDashboardData } from "@/app/portal/actions";
import { AttendanceHeatmap } from "./attendance-heatmap";
import { BadgesRow } from "./badges-row";
import { BELT_COLORS, BELT_LABEL } from "@/lib/portal-utils";
import Link from "next/link";
import { Flame, Target, Award, CreditCard, BookOpen, TrendingUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortalHome({ data }: { data: PortalDashboardData }) {
  const { student, gym, stats, goal, beltProgress, credits, memberships, badges, attendanceDays } = data;

  const activeMembership = memberships.find((m) => m.status === "active" || m.status === "trialing");
  const weekProgress = Math.min(stats.thisWeekClasses / goal.weekly_target, 1);
  const belt = beltProgress?.current_belt ?? student.belt_rank;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <p className="text-xs text-[#9CA3AF] uppercase tracking-widest">{gym.name}</p>
        <h1 className="text-2xl font-bold text-white mt-0.5 tracking-tight">
          {student.full_name.split(" ")[0]}
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full border border-white/20"
            style={{ backgroundColor: BELT_COLORS[belt] }}
          />
          <span className="text-xs text-[#888]">{BELT_LABEL[belt]} Belt</span>
          {beltProgress && (
            <span className="text-xs text-[#9CA3AF]">· {beltProgress.stripes} stripe{beltProgress.stripes !== 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Flame} label="Streak" value={String(stats.currentStreak)} unit="days" highlight={stats.currentStreak > 0} />
        <StatCard icon={TrendingUp} label="Total" value={String(stats.totalClasses)} unit="classes" />
        <StatCard icon={Award} label="Badges" value={String(badges.length)} unit="earned" href="/portal/badges" />
      </div>

      {/* Weekly goal */}
      <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Target className="h-4 w-4 text-[#9CA3AF]" />
            Weekly Goal
          </div>
          <span className="text-xs text-[#9CA3AF]">
            {stats.thisWeekClasses} / {goal.weekly_target} classes
          </span>
        </div>
        <div className="h-2 rounded-full bg-[#111] overflow-hidden">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${weekProgress * 100}%` }}
          />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: goal.weekly_target }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 h-1.5 rounded-full",
                i < stats.thisWeekClasses ? "bg-white" : "bg-[#1f1f1f]",
              )}
            />
          ))}
        </div>
      </section>

      {/* 12-week attendance heat map */}
      <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
        <h2 className="text-sm font-medium text-white">Attendance — last 12 weeks</h2>
        <AttendanceHeatmap days={attendanceDays} />
      </section>

      {/* Belt progress */}
      {beltProgress && (
        <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Belt Progress</h2>
            <span className="text-xs text-[#9CA3AF]">{beltProgress.progress_percentage}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#111] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${beltProgress.progress_percentage}%`,
                backgroundColor: BELT_COLORS[beltProgress.current_belt],
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-4 w-4 rounded-full border",
                  s < beltProgress.stripes
                    ? "bg-white border-white"
                    : "bg-transparent border-[#333]",
                )}
              />
            ))}
            <span className="text-xs text-[#9CA3AF] ml-1">{4 - beltProgress.stripes} stripe{4 - beltProgress.stripes !== 1 ? "s" : ""} to next</span>
          </div>
        </section>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-3">
          <h2 className="text-sm font-medium text-white">Badges Earned</h2>
          <BadgesRow badges={badges} />
        </section>
      )}

      {/* Credits & membership */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex items-center gap-3">
          <div className="h-9 w-9 grid place-items-center rounded-lg border border-[#222] bg-black shrink-0">
            <CreditCard className="h-4 w-4 text-[#888]" />
          </div>
          <div>
            <p className="text-xs text-[#9CA3AF]">Class Credits</p>
            <p className="text-xl font-bold text-white">{credits.class_credits}</p>
          </div>
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex items-center gap-3">
          <div className="h-9 w-9 grid place-items-center rounded-lg border border-[#222] bg-black shrink-0">
            <BookOpen className="h-4 w-4 text-[#888]" />
          </div>
          <div>
            <p className="text-xs text-[#9CA3AF]">Videos Owned</p>
            <p className="text-xl font-bold text-white">{data.instructionals.length}</p>
          </div>
        </div>
      </div>

      {/* Membership */}
      {activeMembership && (
        <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-1">
          <p className="text-xs text-[#9CA3AF] uppercase tracking-widest">Active Membership</p>
          <p className="text-base font-semibold text-white">{activeMembership.plan_name}</p>
          {activeMembership.current_period_end && (
            <p className="text-xs text-[#9CA3AF]">
              Renews {new Date(activeMembership.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  highlight,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        "rounded-xl border bg-[#0a0a0a] p-3 space-y-1 relative",
        highlight ? "border-white/20" : "border-[#1a1a1a]",
        href && "hover:border-[#2a2a2a] transition-colors active:scale-[0.97] cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("h-3.5 w-3.5", highlight ? "text-white" : "text-[#9CA3AF]")} />
          <span className="text-[10px] text-[#9CA3AF] uppercase tracking-widest">{label}</span>
        </div>
        {href && <ChevronRight className="h-3 w-3 text-[#6B7280]" />}
      </div>
      <p className={cn("text-2xl font-bold", highlight ? "text-white" : "text-white")}>{value}</p>
      <p className="text-[10px] text-[#9CA3AF]">{unit}</p>
    </div>
  );
  if (href) return <Link href={href} className="block">{inner}</Link>;
  return inner;
}
