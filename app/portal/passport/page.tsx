/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { Zap, Trophy } from "lucide-react";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrCreatePassport, getPointLedger, awardDailyLoginBonus } from "@/lib/gamification/passport";
import { getUserBadges, checkAndAwardBadges, getAllBadges, computeMaxConsistentWeeks } from "@/lib/gamification/badges";
import { getActiveChallengesWithProgress } from "@/lib/gamification/challenges";
import { PassportCard } from "@/components/gamification/PassportCard";
import { ChallengesSection } from "@/components/gamification/ChallengesSection";
import { BadgeToastTrigger } from "@/components/gamification/BadgeToastTrigger";
import type { UserBadge } from "@/lib/gamification/types";

export const dynamic = "force-dynamic";

// How-to-earn guide shown below the card
const EARN_EXAMPLES = [
  { icon: "🥋", label: "Attend a class",          points: "+25 pts" },
  { icon: "�", label: "Log in daily",            points: "+5 pts" },
  { icon: "🔥", label: "3-day check-in streak",   points: "🏅 Badge" },
  { icon: "🏆", label: "Complete a challenge",    points: "+50 pts" },
];

export default async function PassportPage() {
  const identity = await getCurrentStudentIdentity();
  if (!identity) redirect("/login");
  if (!identity.gymId) redirect("/login?error=no_student");

  const gymId = identity.gymId;

  // Only fetch full_name — gym_id already available from identity
  const admin = createAdminClient() as any;
  const { data: student } = await admin
    .from("students")
    .select("full_name, belt_rank")
    .eq("id", identity.studentId)
    .maybeSingle();

  if (!student) redirect("/login?error=no_student");

  const { full_name, belt_rank: currentBeltRank } =
    student as { full_name: string; belt_rank: string };

  // Award the daily login bonus first (before badge evaluation so any
  // points-milestone badges triggered by the bonus are caught below).
  const dailyBonus = await awardDailyLoginBonus(identity.authUserId, gymId);

  // Fetch all passport data in parallel.
  // checkAndAwardBadges is run after the daily bonus so newly awarded
  // points are already reflected in the passport before evaluation.
  const [
    passport, badges, ledger, challenges, newBadges,
    allBadges, attendanceRes, challengeCountRes,
  ] = await Promise.all([
    getOrCreatePassport(identity.authUserId, gymId),
    getUserBadges(identity.authUserId, gymId),
    getPointLedger(identity.authUserId, gymId, 10),
    getActiveChallengesWithProgress(identity.authUserId, gymId),
    checkAndAwardBadges(identity.authUserId, gymId).catch((): UserBadge[] => []),
    getAllBadges(),
    // Attendance rows: used for classesAttended count AND weeklyConsistencyWeeks
    admin
      .from("attendance")
      .select("class_date")
      .eq("student_id", identity.studentId),
    // Completed challenges count for progress indicators
    admin
      .from("user_challenge_progress")
      .select("id", { count: "exact", head: true })
      .eq("user_id", identity.authUserId)
      .eq("gym_id", gymId)
      .not("completed_at", "is", null),
  ]);

  const attendanceRows         = (attendanceRes.data  ?? []) as Array<{ class_date: string }>;
  const classesAttended         = attendanceRows.length;
  const weeklyConsistencyWeeks  = computeMaxConsistentWeeks(attendanceRows);
  const challengesCompleted     = (challengeCountRes.count ?? 0) as number;

  return (
    <div className="space-y-6 pb-4">
      {/* Fire toasts for daily bonus + any badges earned during this page load */}
      <BadgeToastTrigger newBadges={newBadges} dailyBonus={dailyBonus} />
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Passport</h1>
        <p className="text-sm text-[#555] mt-1">
          Track your progress, earn badges, and level up.
        </p>
      </div>

      {/* Passport card — all data rendered server-side */}
      <PassportCard
        passport={passport}
        badges={badges}
        allBadges={allBadges}
        ledger={ledger}
        studentName={full_name}
        classesAttended={classesAttended}
        challengesCompleted={challengesCompleted}
        weeklyConsistencyWeeks={weeklyConsistencyWeeks}
        currentBeltRank={currentBeltRank}
        dailyBonus={dailyBonus}
      />

      {/* Active Challenges */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-[#555]" />
          <h2 className="text-sm font-semibold text-white">Active Challenges</h2>
        </div>
        <ChallengesSection challenges={challenges} />
      </div>

      {/* How to earn points */}
      <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[#555]" />
          <h2 className="text-sm font-semibold text-white">How to earn points</h2>
        </div>
        <div className="space-y-3">
          {EARN_EXAMPLES.map(({ icon, label, points }) => (
            <div key={label} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{icon}</span>
                <span className="text-sm text-[#9CA3AF]">{label}</span>
              </div>
              <span className="text-xs font-semibold text-white bg-[#1a1a1a] rounded-full px-2.5 py-1">
                {points}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
