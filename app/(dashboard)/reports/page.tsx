/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import {
  atRiskStudents,
  avgAttendance,
  beltDistribution,
  isoDaysBefore,
  leadSourcePerformance,
  mrrCents,
  rangeDays,
  retentionRate,
  revenueByPlan,
  type RangeKey,
} from "@/lib/reports";
import { ReportsView } from "@/components/reports/reports-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports · MatFlow" };

const VALID_RANGES: RangeKey[] = ["30d", "90d", "all"];

function parseRange(v: string | string[] | undefined): RangeKey {
  const s = Array.isArray(v) ? v[0] : v;
  return (VALID_RANGES as string[]).includes(s ?? "")
    ? (s as RangeKey)
    : "30d";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const days = rangeDays(range);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const studentIds = gymId
    ? ((await supabase.from("students").select("id").eq("gym_id", gymId)).data ?? []).map((s: any) => s.id) // eslint-disable-line @typescript-eslint/no-explicit-any
    : null;

  // Fetch in parallel. We deliberately pull more than the window for some
  // calculations (e.g. retention requires students who joined before the
  // window started).
  let attendanceQuery = supabase
    .from("attendance")
    .select("student_id, checked_in_at");
  if (days !== null) {
    attendanceQuery = attendanceQuery.gte("checked_in_at", isoDaysBefore(days)) as typeof attendanceQuery;
  }
  if (studentIds) {
    attendanceQuery = attendanceQuery.in("student_id", studentIds) as typeof attendanceQuery;
  }

  let leadsQuery = supabase.from("leads").select("source, status, created_at");
  if (days !== null) {
    leadsQuery = leadsQuery.gte("created_at", isoDaysBefore(days)) as typeof leadsQuery;
  }
  if (gymId) {
    leadsQuery = leadsQuery.eq("gym_id", gymId) as typeof leadsQuery;
  }

  let allAttQuery = supabase.from("attendance").select("student_id, checked_in_at");
  if (studentIds) {
    allAttQuery = allAttQuery.in("student_id", studentIds) as typeof allAttQuery;
  }

  const [
    studentsRes,
    beltsRes,
    attendanceRes,
    membershipsRes,
    plansRes,
    leadsRes,
    allAttendanceRes,
  ] = await Promise.all([
    gymId
      ? supabase.from("students").select("id, full_name, belt_rank, status, join_date").eq("gym_id", gymId)
      : supabase.from("students").select("id, full_name, belt_rank, status, join_date"),
    studentIds
      ? supabase.from("belt_progress").select("student_id, current_belt, stripes").in("student_id", studentIds)
      : supabase.from("belt_progress").select("student_id, current_belt, stripes"),
    attendanceQuery,
    studentIds
      ? supabase.from("memberships").select("id, student_id, plan_id, status, custom_price_cents").in("student_id", studentIds)
      : supabase.from("memberships").select("id, student_id, plan_id, status, custom_price_cents"),
    gymId
      ? supabase.from("membership_plans").select("id, name, price_cents, interval").eq("gym_id", gymId)
      : supabase.from("membership_plans").select("id, name, price_cents, interval"),
    leadsQuery,
    allAttQuery,
  ]);

  const students = studentsRes.data ?? [];
  const belts = beltsRes.data ?? [];
  const rangedAttendance = attendanceRes.data ?? [];
  const allAttendance = allAttendanceRes.data ?? [];
  const memberships = membershipsRes.data ?? [];
  const plans = plansRes.data ?? [];
  const leads = leadsRes.data ?? [];

  // Stats
  const retention30 = retentionRate(students, 30);
  const retention90 = retentionRate(students, 90);
  const atRisk = atRiskStudents(students, allAttendance, 14);
  const mrr = mrrCents(memberships, plans);
  const avg = avgAttendance(
    students,
    days === null ? allAttendance : rangedAttendance,
    days ?? 30,
  );

  // Distributions
  const buckets = beltDistribution(students, belts);
  const sources = leadSourcePerformance(leads);
  const planRevenue = revenueByPlan(memberships, plans);

  return (
    <ReportsView
      range={range}
      stats={{
        retention30: retention30.rate,
        retention30Cohort: retention30.cohort,
        retention90: retention90.rate,
        retention90Cohort: retention90.cohort,
        atRiskCount: atRisk.length,
        mrrCents: mrr,
        avgAttendance: avg.avg,
        avgAttendanceWindowDays: days ?? 30,
        totalCheckIns: avg.total,
        activeStudents: avg.activeStudents,
      }}
      buckets={buckets}
      sources={sources}
      planRevenue={planRevenue}
      atRisk={atRisk}
    />
  );
}
