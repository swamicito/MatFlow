/* eslint-disable @typescript-eslint/no-explicit-any */
import { Users, UserPlus, DollarSign, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { DemoControls } from "@/components/dashboard/demo-controls";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isRevenueStatus, toMonthlyCents, formatMoney } from "@/lib/billing";
import { getDemoStatus } from "@/app/(dashboard)/dashboard/demo-actions";
import { TODAYS_CLASSES } from "@/lib/checkin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";

export const dynamic = "force-dynamic";

const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function DashboardPage() {
  const now = new Date();
  const todayLabel = `${DOW[now.getDay()]}, ${MON[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const [studentsRes, leadsRes, membershipsRes, plansRes, demo, recentCheckinsRes, recentLeadsRes] =
    await Promise.all([
      gymId
        ? supabase.from("students").select("id, status", { count: "exact" }).eq("gym_id", gymId)
        : supabase.from("students").select("id, status", { count: "exact" }),
      gymId
        ? supabase.from("leads").select("id, status", { count: "exact" }).eq("gym_id", gymId)
        : supabase.from("leads").select("id, status", { count: "exact" }),
      gymId
        ? supabase.from("memberships").select("status, custom_price_cents, plan_id").in("student_id",
            (await supabase.from("students").select("id").eq("gym_id", gymId)).data?.map((s: any) => s.id) ?? [])
        : supabase.from("memberships").select("status, custom_price_cents, plan_id"),
      gymId
        ? supabase.from("membership_plans").select("id, price_cents, interval").eq("gym_id", gymId)
        : supabase.from("membership_plans").select("id, price_cents, interval"),
      getDemoStatus(),
      gymId
        ? supabase
            .from("attendance")
            .select("id, student_id, class_type, checked_in_at, students(full_name)")
            .in("student_id",
              (await supabase.from("students").select("id").eq("gym_id", gymId)).data?.map((s: any) => s.id) ?? [])
            .order("checked_in_at", { ascending: false })
            .limit(6)
        : supabase
            .from("attendance")
            .select("id, student_id, class_type, checked_in_at, students(full_name)")
            .order("checked_in_at", { ascending: false })
            .limit(6),
      gymId
        ? supabase.from("leads").select("id, name, source, created_at").eq("gym_id", gymId).order("created_at", { ascending: false }).limit(4)
        : supabase.from("leads").select("id, name, source, created_at").order("created_at", { ascending: false }).limit(4),
    ]);

  const totalStudents = studentsRes.count ?? 0;
  const totalLeads = leadsRes.count ?? 0;
  const convertedLeads = (leadsRes.data ?? []).filter(
    (l: any) => l.status === "converted",
  ).length;
  const conversionRate =
    totalLeads > 0
      ? `${((convertedLeads / totalLeads) * 100).toFixed(1)}%`
      : "—";

  const planById = new Map(
    (plansRes.data ?? []).map((p: any) => [p.id, p] as const),
  );
  const mrrCents = (membershipsRes.data ?? [])
    .filter((m: any) => isRevenueStatus(m.status))
    .reduce((acc: number, m: any) => {
      const plan = planById.get(m.plan_id);
      if (!plan) return acc;
      const cents = m.custom_price_cents ?? (plan as any).price_cents;
      return acc + toMonthlyCents(cents, (plan as any).interval);
    }, 0);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            An overview of your academy at a glance.
          </p>
        </div>
        <DemoControls
          loaded={demo.loaded}
          studentCount={demo.studentCount}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Students"
          value={String(totalStudents)}
          icon={Users}
        />
        <StatCard
          label="Total Leads"
          value={String(totalLeads)}
          icon={UserPlus}
        />
        <StatCard
          label="MRR"
          value={formatMoney(Math.round(mrrCents))}
          icon={DollarSign}
        />
        <StatCard
          label="Conversion Rate"
          value={conversionRate}
          icon={TrendingUp}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentActivity
          checkins={(recentCheckinsRes.data ?? []).map((r: any) => {
            const student = Array.isArray(r.students) ? r.students[0] : r.students;
            return {
              id: r.id,
              studentName: (student as { full_name?: string } | null)?.full_name ?? "Unknown",
              classType: r.class_type ?? "Open Mat",
              checkedInAt: r.checked_in_at,
            };
          })}
          recentLeads={(recentLeadsRes.data ?? []).map((l: any) => ({
            id: l.id,
            name: l.name,
            source: l.source ?? "Direct",
            createdAt: l.created_at,
          }))}
          demoLoaded={demo.loaded}
        />
        <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-white leading-snug">
              Today&apos;s Schedule
              <span className="block text-xs text-[#555] font-normal mt-0.5">{todayLabel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-[#111]">
              {TODAYS_CLASSES.map((cls) => (
                <li key={cls.time} className="flex items-center justify-between px-6 py-2.5 text-sm">
                  <span className="text-white">{cls.label}</span>
                  <span className="text-[#666] tabular-nums">{cls.time}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
