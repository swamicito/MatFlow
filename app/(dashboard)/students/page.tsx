/* eslint-disable @typescript-eslint/no-explicit-any */
import { StudentsPageClient } from "@/components/students/students-page-client";
import { isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type BeltProgress = Database["public"]["Tables"]["belt_progress"]["Row"];
type Membership = Database["public"]["Tables"]["memberships"]["Row"];
type Waiver = Database["public"]["Tables"]["waivers"]["Row"];

export default async function StudentsPage() {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const studentIds = gymId
    ? ((await supabase.from("students").select("id").eq("gym_id", gymId)).data ?? []).map((s: any) => s.id)
    : null;

  const [studentsRes, progressRes, membershipsRes, plansRes, familiesRes, waiversRes] =
    await Promise.all([
      gymId
        ? supabase.from("students").select("*").eq("gym_id", gymId).order("created_at", { ascending: false })
        : supabase.from("students").select("*").order("created_at", { ascending: false }),
      studentIds
        ? supabase.from("belt_progress").select("*").in("student_id", studentIds)
        : supabase.from("belt_progress").select("*"),
      studentIds
        ? supabase.from("memberships").select("*").in("student_id", studentIds).in("status", ["active", "trialing", "past_due", "paused"])
        : supabase.from("memberships").select("*").in("status", ["active", "trialing", "past_due", "paused"]),
      gymId
        ? supabase.from("membership_plans").select("*").eq("gym_id", gymId).order("price_cents", { ascending: true })
        : supabase.from("membership_plans").select("*").order("price_cents", { ascending: true }),
      gymId
        ? supabase.from("family_accounts").select("*").eq("gym_id", gymId).order("parent_name", { ascending: true })
        : supabase.from("family_accounts").select("*").order("parent_name", { ascending: true }),
      studentIds
        ? supabase.from("waivers").select("*").in("student_id", studentIds).order("signed_at", { ascending: false })
        : supabase.from("waivers").select("*").order("signed_at", { ascending: false }),
    ]);

  const error =
    studentsRes.error ??
    progressRes.error ??
    membershipsRes.error ??
    plansRes.error ??
    familiesRes.error ??
    waiversRes.error;

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Students
        </h1>
        <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
          Failed to load students: {error.message}
        </p>
      </div>
    );
  }

  const progressByStudent: Record<string, BeltProgress> = {};
  for (const row of progressRes.data ?? []) {
    progressByStudent[row.student_id] = row;
  }

  // Pick a single "current" membership per student (most recent created).
  const membershipByStudent: Record<string, Membership> = {};
  for (const m of membershipsRes.data ?? []) {
    const existing = membershipByStudent[m.student_id];
    if (!existing || existing.created_at < m.created_at) {
      membershipByStudent[m.student_id] = m;
    }
  }

  const waiversByStudent: Record<string, Waiver[]> = {};
  for (const w of waiversRes.data ?? []) {
    (waiversByStudent[w.student_id] ??= []).push(w);
  }

  return (
    <StudentsPageClient
      students={studentsRes.data ?? []}
      progressByStudent={progressByStudent}
      membershipByStudent={membershipByStudent}
      plans={plansRes.data ?? []}
      stripeConfigured={isStripeConfigured()}
      families={familiesRes.data ?? []}
      waiversByStudent={waiversByStudent}
    />
  );
}
