/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BillingOverview,
  type EnrichedMembership,
} from "@/components/billing/billing-overview";
import { isRevenueStatus, toMonthlyCents } from "@/lib/billing";
import { isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import type { MembershipInterval } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const { data: studentRows } = gymId
    ? await supabase.from("students").select("id").eq("gym_id", gymId)
    : { data: null };
  const studentIds: string[] | null = studentRows ? studentRows.map((s: any) => s.id) : null;

  const [membershipsRes, plansRes, studentsRes, plansCountRes] =
    await Promise.all([
      studentIds
        ? supabase.from("memberships").select("*").in("student_id", studentIds).order("created_at", { ascending: false })
        : supabase.from("memberships").select("*").order("created_at", { ascending: false }),
      gymId
        ? supabase.from("membership_plans").select("*").eq("gym_id", gymId)
        : supabase.from("membership_plans").select("*"),
      gymId
        ? supabase.from("students").select("id, full_name").eq("gym_id", gymId)
        : supabase.from("students").select("id, full_name"),
      gymId
        ? supabase.from("membership_plans").select("id", { count: "exact", head: true }).eq("gym_id", gymId)
        : supabase.from("membership_plans").select("id", { count: "exact", head: true }),
    ]);

  const error =
    membershipsRes.error ?? plansRes.error ?? studentsRes.error ?? plansCountRes.error;

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Billing
        </h1>
        <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
          Failed to load: {error.message}
        </p>
      </div>
    );
  }

  type PlanRow = { id: string; gym_id: string; name: string; price_cents: number; interval: MembershipInterval; stripe_product_id: string | null; stripe_price_id: string | null; description: string | null; created_at: string };
  type StudentRow = { id: string; full_name: string };
  type MembershipRow = { id: string; student_id: string; plan_id: string; custom_price_cents: number | null; stripe_subscription_id: string | null; stripe_price_id: string | null; status: string; start_date: string; current_period_end: string | null; cancel_at_period_end: boolean; created_at: string };
  const planById = new Map(
    ((plansRes.data ?? []) as PlanRow[]).map((p) => [p.id, p] as const),
  );
  const studentName = new Map(
    ((studentsRes.data ?? []) as StudentRow[]).map((s) => [s.id, s.full_name] as const),
  );

  const enriched = ((membershipsRes.data ?? []) as MembershipRow[]).flatMap(
    (m) => {
      const plan = planById.get(m.plan_id);
      if (!plan) return [];
      const effective = m.custom_price_cents ?? plan.price_cents;
      return [
        {
          ...m,
          student_name: studentName.get(m.student_id) ?? "Unknown",
          plan_name: plan.name,
          plan_interval: plan.interval,
          plan_price_cents: plan.price_cents,
          effective_price_cents: effective,
        },
      ];
    },
  ) as EnrichedMembership[];

  const mrrCents = enriched
    .filter((m) => isRevenueStatus(m.status))
    .reduce(
      (acc, m) => acc + toMonthlyCents(m.effective_price_cents, m.plan_interval),
      0,
    );

  const active = enriched.filter(
    (m) => m.status === "active" || m.status === "trialing" || m.status === "paused",
  );
  const pastDue = enriched.filter((m) => m.status === "past_due");

  const activeCount = enriched.filter((m) => m.status === "active").length;
  const trialingCount = enriched.filter((m) => m.status === "trialing").length;
  const pastDueCount = pastDue.length;

  return (
    <BillingOverview
      mrrCents={mrrCents}
      activeCount={activeCount}
      pastDueCount={pastDueCount}
      trialingCount={trialingCount}
      plansCount={plansCountRes.count ?? 0}
      active={active}
      pastDue={pastDue}
      stripeConfigured={isStripeConfigured()}
    />
  );
}
