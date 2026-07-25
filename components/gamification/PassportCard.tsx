import { Flame, TrendingUp, Star, Award, Zap, Sparkles, Lock, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  levelForPoints,
  levelProgress,
  pointsToNextLevel,
  POINTS_PER_LEVEL,
  type UserPassport,
  type UserBadge,
  type Badge,
  type PointLedgerEntry,
} from "@/lib/gamification/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const REASON_LABEL: Record<string, string> = {
  class_checkin:      "Class check-in",
  challenge_complete: "Challenge completed",
  badge_earned:       "Badge earned",
  manual_award:       "Points awarded",
  manual_deduction:   "Points deducted",
};

function formatReason(reason: string): string {
  return REASON_LABEL[reason] ?? reason.replace(/_/g, " ");
}

// ─── Badge Collection helpers ──────────────────────────────────────────────────

const BADGE_GROUPS: Array<{ type: string; label: string }> = [
  { type: "classes_attended",   label: "Mat Time" },
  { type: "streak",             label: "Streak" },
  { type: "weekly_consistency", label: "Weekly Habit" },
  { type: "points",             label: "Points" },
  { type: "challenge_complete", label: "Challenges" },
  { type: "belt_rank",          label: "Belt Journey" },
];

const BELT_NAMES = ["White","Gray","Yellow","Orange","Green","Blue","Purple","Brown","Black"];

const BELT_ORDINAL_MAP: Record<string, number> = {
  white: 0, gray: 1, yellow: 2, orange: 3,
  green: 4, blue: 5, purple: 6, brown: 7, black: 8,
};

function requirementText(badge: Badge): string {
  switch (badge.criteria_type) {
    case "classes_attended":    return `Attend ${badge.criteria_value} classes`;
    case "streak":              return `Reach a ${badge.criteria_value}-day check-in streak`;
    case "weekly_consistency":  return `Train 3×/week for ${badge.criteria_value} weeks straight`;
    case "points":              return `Earn ${badge.criteria_value.toLocaleString()} points`;
    case "challenge_complete":  return badge.criteria_value === 1
      ? "Complete your first Passport Challenge"
      : `Complete ${badge.criteria_value} Passport Challenges`;
    case "belt_rank":           return `Earn your ${BELT_NAMES[badge.criteria_value] ?? "advanced"} belt`;
    default:                    return badge.description ?? `Reach level ${badge.criteria_value}`;
  }
}

type ProgressInfo = { current: number; max: number } | null;

function badgeProgress(
  badge: Badge,
  passport: UserPassport,
  classesAttended: number,
  challengesCompleted: number,
  weeklyConsistencyWeeks: number,
): ProgressInfo {
  switch (badge.criteria_type) {
    case "classes_attended":   return { current: classesAttended,        max: badge.criteria_value };
    case "streak":             return { current: passport.longest_streak, max: badge.criteria_value };
    case "points":             return { current: passport.points,         max: badge.criteria_value };
    case "challenge_complete": return { current: challengesCompleted,     max: badge.criteria_value };
    case "weekly_consistency": return { current: weeklyConsistencyWeeks,  max: badge.criteria_value };
    default:                   return null;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBlock({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-1 flex-1",
      accent ? "border-white/20 bg-[#0f0f0f]" : "border-[#1a1a1a] bg-[#0a0a0a]"
    )}>
      <p className="text-[11px] text-[#555] uppercase tracking-widest font-medium">{label}</p>
      <p className={cn("text-3xl font-bold tabular-nums", accent ? "text-white" : "text-white")}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-[#444]">{sub}</p>}
    </div>
  );
}

function BadgeChip({ badge, isNew }: { badge: UserBadge; isNew?: boolean }) {
  const icon = badge.badge?.icon ?? "🏅";
  const name = badge.badge?.name ?? "Badge";
  const desc = badge.badge?.description ?? name;
  return (
    <div
      className="flex flex-col items-center gap-1.5 relative"
      title={desc}
    >
      <div className={cn(
        "h-14 w-14 rounded-2xl border flex items-center justify-center text-2xl transition-shadow",
        isNew
          ? "border-amber-400/40 bg-amber-500/10 shadow-[0_0_16px_rgba(245,158,11,0.22)]"
          : "border-white/10 bg-[#111] hover:border-white/20",
      )}>
        {icon}
      </div>
      {isNew && (
        <span className="absolute -top-1.5 -right-1.5 text-[8px] font-black bg-amber-400 text-black rounded-full px-1.5 py-0.5 leading-none tracking-wide">
          NEW
        </span>
      )}
      <span className="text-[10px] text-[#666] text-center leading-tight max-w-[56px] truncate font-medium">
        {name}
      </span>
    </div>
  );
}

function RecentBadgeCard({ badge }: { badge: UserBadge }) {
  const icon = badge.badge?.icon ?? "🏅";
  const name = badge.badge?.name ?? "Badge";
  const desc = badge.badge?.description ?? "";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-black/40 p-3">
      <div className="h-12 w-12 rounded-xl border border-amber-400/30 bg-amber-500/10 shadow-[0_0_12px_rgba(245,158,11,0.15)] flex items-center justify-center text-2xl shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-white truncate">{name}</p>
          <span className="text-[8px] font-black bg-amber-400 text-black rounded-full px-1.5 py-0.5 leading-none tracking-wide shrink-0">
            NEW
          </span>
        </div>
        {desc && (
          <p className="text-[11px] text-[#555] leading-snug line-clamp-2">{desc}</p>
        )}
        <p className="text-[10px] text-amber-600/60 mt-0.5">{relativeTime(badge.earned_at)}</p>
      </div>
    </div>
  );
}

function LedgerRow({ entry }: { entry: PointLedgerEntry }) {
  const isPositive = entry.points > 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#111] last:border-0">
      <div className="flex items-center gap-3">
        <div className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
          isPositive ? "bg-emerald-500/10" : "bg-red-500/10"
        )}>
          <Zap className={cn("h-3.5 w-3.5", isPositive ? "text-emerald-400" : "text-red-400")} />
        </div>
        <div>
          <p className="text-sm font-medium text-white">{formatReason(entry.reason)}</p>
          <p className="text-[11px] text-[#444]">{relativeTime(entry.created_at)}</p>
        </div>
      </div>
      <span className={cn(
        "text-sm font-bold tabular-nums",
        isPositive ? "text-emerald-400" : "text-red-400"
      )}>
        {isPositive ? "+" : ""}{entry.points}
      </span>
    </div>
  );
}

// ─── Badge Collection Section ────────────────────────────────────────────────

function BadgeCollectionSection({
  allBadges,
  earnedBadges,
  passport,
  classesAttended,
  challengesCompleted,
  weeklyConsistencyWeeks,
  currentBeltRank,
}: {
  allBadges: Badge[];
  earnedBadges: UserBadge[];
  passport: UserPassport;
  classesAttended: number;
  challengesCompleted: number;
  weeklyConsistencyWeeks: number;
  currentBeltRank: string;
}) {
  const earnedMap    = new Map(earnedBadges.map((ub) => [ub.badge_id, ub]));
  const activeGroups = BADGE_GROUPS.filter((g) =>
    allBadges.some((b) => b.criteria_type === g.type),
  );

  return (
    <details className="group rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden" open>
      <summary className="flex items-center justify-between p-4 cursor-pointer list-none select-none">
        <div className="flex items-center gap-2">
          <Award className="h-3.5 w-3.5 text-[#555]" />
          <h2 className="text-sm font-semibold text-white">Badge Collection</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#555]">
            {earnedBadges.length} / {allBadges.length}
          </span>
          <ChevronDown className="h-4 w-4 text-[#555] transition-transform duration-200 group-open:rotate-180" />
        </div>
      </summary>

      <div className="border-t border-[#111] px-4 pb-4 pt-4 space-y-5">
        {activeGroups.map((group) => {
          const groupBadges = allBadges
            .filter((b) => b.criteria_type === group.type)
            .sort((a, b) => a.criteria_value - b.criteria_value);

          return (
            <div key={group.type}>
              <p className="text-[10px] text-[#444] uppercase tracking-widest font-medium mb-2">
                {group.label}
              </p>
              <div className="space-y-1.5">
                {groupBadges.map((badge) => {
                  const ub       = earnedMap.get(badge.id);
                  const progress = ub ? null : badgeProgress(badge, passport, classesAttended, challengesCompleted, weeklyConsistencyWeeks);
                  const pct      = progress
                    ? Math.min(100, Math.round((progress.current / progress.max) * 100))
                    : 0;

                  if (ub) {
                    return (
                      <div
                        key={badge.id}
                        className="flex items-center gap-3 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5"
                      >
                        <div className="h-9 w-9 rounded-xl border border-white/10 bg-[#111] flex items-center justify-center text-lg shrink-0">
                          {badge.icon ?? "🏅"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{badge.name}</p>
                          <p className="text-[10px] text-[#444]">
                            Earned{" "}
                            {new Date(ub.earned_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={badge.id}
                      className="flex items-start gap-3 rounded-lg bg-[#0a0a0a] border border-[#111] px-3 py-2.5 opacity-55"
                    >
                      <div className="h-9 w-9 rounded-xl border border-[#1a1a1a] bg-[#0f0f0f] flex items-center justify-center text-lg shrink-0 grayscale">
                        {badge.icon ?? "🏅"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#666] truncate">{badge.name}</p>
                        <p className="text-[10px] text-[#444] mb-1">{requirementText(badge)}</p>
                        {badge.criteria_type === "belt_rank" && (
                          <p className="text-[10px] text-[#444] mb-1.5">
                            Current:{" "}
                            {BELT_NAMES[BELT_ORDINAL_MAP[currentBeltRank] ?? 0] ?? "White"} belt
                            {" → "}
                            {BELT_NAMES[badge.criteria_value] ?? "advanced"} belt
                          </p>
                        )}
                        {progress && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-[#555] tabular-nums">
                                {progress.current.toLocaleString()} / {progress.max.toLocaleString()}
                              </span>
                              <span className="text-[9px] text-[#444]">{pct}%</span>
                            </div>
                            <div className="h-1 rounded-full bg-[#1a1a1a] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-white/25"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <Lock className="h-3.5 w-3.5 text-[#333] shrink-0 mt-0.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type PassportCardProps = {
  passport: UserPassport;
  badges: UserBadge[];
  allBadges: Badge[];
  ledger: PointLedgerEntry[];
  studentName: string;
  classesAttended: number;
  challengesCompleted: number;
  weeklyConsistencyWeeks: number;
  currentBeltRank: string;
  dailyBonus?: boolean;
};

export function PassportCard({
  passport, badges, allBadges, ledger, studentName,
  classesAttended, challengesCompleted, weeklyConsistencyWeeks, currentBeltRank,
  dailyBonus = false,
}: PassportCardProps) {
  const level = levelForPoints(passport.points);
  const progress = levelProgress(passport.points);
  const xpToNext = pointsToNextLevel(passport.points);
  const xpIntoLevel = passport.points - (level - 1) * POINTS_PER_LEVEL;

  return (
    <div className="space-y-4">
      {/* ── Level Hero Card ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1 w-full bg-gradient-to-r from-white/5 via-white/30 to-white/5" />

        <div className="p-6 space-y-5">
          {/* Level badge + name */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#555] mb-1">
                MatFlow Passport
              </p>
              <p className="text-lg font-semibold text-white truncate max-w-[200px]">
                {studentName}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="h-16 w-16 rounded-2xl border-2 border-white/20 bg-[#111] flex flex-col items-center justify-center">
                <Star className="h-3 w-3 text-[#555] mb-0.5" />
                <span className="text-2xl font-black text-white leading-none">{level}</span>
              </div>
              <span className="text-[10px] text-[#444] uppercase tracking-widest">Level</span>
            </div>
          </div>

          {/* XP progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#555]">
                Level {level} → {level + 1}
              </span>
              <span className="text-white font-medium tabular-nums">
                {xpIntoLevel} / {POINTS_PER_LEVEL} XP
              </span>
            </div>
            <div className="h-3 rounded-full bg-[#171717] overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all duration-700"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="text-[11px] text-[#555]">
              You&apos;re <span className="text-white font-semibold tabular-nums">{xpToNext.toLocaleString()} pts</span> away from Level {level + 1}
            </p>
          </div>

          {/* Points total */}
          <div className="flex items-center gap-2 pt-1">
            <Award className="h-4 w-4 text-[#555]" />
            <span className="text-2xl font-bold text-white tabular-nums">
              {passport.points.toLocaleString()}
            </span>
            <span className="text-sm text-[#555]">total points</span>
            {dailyBonus && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 shrink-0">
                <CheckCircle2 className="h-3 w-3" />
                Bonus claimed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Streak Stats ──────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <div className={cn(
          "rounded-xl border p-4 flex-1 space-y-1",
          passport.current_streak > 0
            ? "border-orange-500/30 bg-orange-500/5"
            : "border-[#1a1a1a] bg-[#0a0a0a]"
        )}>
          <div className="flex items-center gap-1.5">
            <Flame className={cn(
              "h-3.5 w-3.5",
              passport.current_streak > 0 ? "text-orange-400" : "text-[#555]"
            )} />
            <p className="text-[11px] text-[#555] uppercase tracking-widest font-medium">
              Streak
            </p>
          </div>
          <p className={cn(
            "text-4xl font-black tabular-nums",
            passport.current_streak > 0 ? "text-orange-400" : "text-white"
          )}>
            {passport.current_streak}
          </p>
          <p className="text-[11px] text-[#444]">days</p>
        </div>

        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-[#555]" />
            <p className="text-[11px] text-[#555] uppercase tracking-widest font-medium">
              Best
            </p>
          </div>
          <p className="text-4xl font-black text-white tabular-nums">
            {passport.longest_streak}
          </p>
          <p className="text-[11px] text-[#444]">days</p>
        </div>
      </div>

      {/* ── Badges ────────────────────────────────────────────────────────── */}
      {(() => {
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const recentBadges = badges.filter(
          (ub) => new Date(ub.earned_at) >= fortyEightHoursAgo,
        );
        const recentIds   = new Set(recentBadges.map((b) => b.id));

        return (
          <div className="space-y-3">
            {/* Recently earned — only visible when badges earned in last 48 hours */}
            {recentBadges.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    <h2 className="text-xs font-semibold text-amber-400/90 uppercase tracking-wider">
                      Recently Earned
                    </h2>
                  </div>
                  <span className="text-[10px] text-amber-600">last 48 hrs</span>
                </div>
                <div className="space-y-2">
                  {recentBadges.map((ub) => (
                    <RecentBadgeCard key={ub.id} badge={ub} />
                  ))}
                </div>
              </div>
            )}

            {/* Full badge collection */}
            <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Badges Earned</h2>
                <span className="text-xs text-[#555]">{badges.length} earned</span>
              </div>

              {badges.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-3xl">🏅</p>
                  <p className="text-sm text-[#555]">Keep training to earn your first badge!</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {badges.map((ub) => (
                    <BadgeChip key={ub.id} badge={ub} isNew={recentIds.has(ub.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Badge Collection (collapsible roadmap) ─────────────────────────── */}
      <BadgeCollectionSection
        allBadges={allBadges}
        earnedBadges={badges}
        passport={passport}
        classesAttended={classesAttended}
        challengesCompleted={challengesCompleted}
        weeklyConsistencyWeeks={weeklyConsistencyWeeks}
        currentBeltRank={currentBeltRank}
      />

      {/* ── Recent Activity ───────────────────────────────────────────────── */}
      {ledger.length > 0 && (
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-1">
          <h2 className="text-sm font-semibold text-white mb-3">Recent Activity</h2>
          {ledger.map((entry) => (
            <LedgerRow key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {ledger.length === 0 && (
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-6 text-center space-y-2">
          <Zap className="h-6 w-6 text-[#333] mx-auto" />
          <p className="text-sm text-[#555]">
            No activity yet. Check in to a class to start earning points!
          </p>
        </div>
      )}
    </div>
  );
}
