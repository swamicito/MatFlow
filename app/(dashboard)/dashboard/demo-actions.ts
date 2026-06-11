"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import type {
  BeltRank,
  Database,
  LeadStatus,
  StudentStatus,
} from "@/lib/supabase/types";

export type DemoActionResult =
  | { ok: true; message: string; counts: DemoCounts }
  | { ok: false; error: string };

export type DemoCounts = {
  students: number;
  belt_progress: number;
  families: number;
  leads: number;
  plans: number;
  memberships: number;
};

const DEMO_TAG = "[DEMO DATA]";

// ─────────────────── Status check ───────────────────

export async function getDemoStatus(): Promise<{
  loaded: boolean;
  studentCount: number;
}> {
  const supabase = createAdminClient() as any;
  const { count } = await supabase
    .from("students")
    .select("id", { count: "exact", head: true })
    .ilike("notes", `%${DEMO_TAG}%`);
  return { loaded: (count ?? 0) > 0, studentCount: count ?? 0 };
}

// ─────────────────── Sample data ───────────────────

type StudentSeed = {
  full_name: string;
  email: string;
  phone: string;
  belt_rank: BeltRank;
  stripes: number;
  is_adult: boolean;
  status: StudentStatus;
  joined_months_ago: number;
  family_key?: string; // groups members of the same family
  family_role?: "parent" | "child";
  membership_plan?: string;
  custom_price?: number;
};

const PLANS: { name: string; price_cents: number; description: string }[] = [
  {
    name: "Unlimited Adult",
    price_cents: 18900,
    description: "All adult classes, unlimited.",
  },
  {
    name: "Kids Program",
    price_cents: 12900,
    description: "Kids classes, twice weekly minimum.",
  },
  {
    name: "Family Plan",
    price_cents: 27900,
    description: "Up to 4 family members, unlimited.",
  },
  {
    name: "Trial 30-Day",
    price_cents: 4900,
    description: "30 days, all classes, one-time.",
  },
];

const STUDENTS: StudentSeed[] = [
  // Family: Silva (parent + 2 kids)
  {
    full_name: "Ricardo Silva",
    email: "ricardo.silva@example.com",
    phone: "732-555-0101",
    belt_rank: "purple",
    stripes: 3,
    is_adult: true,
    status: "active",
    joined_months_ago: 22,
    family_key: "silva",
    family_role: "parent",
    membership_plan: "Family Plan",
  },
  {
    full_name: "Lucas Silva",
    email: "lucas.silva@example.com",
    phone: "732-555-0102",
    belt_rank: "yellow",
    stripes: 2,
    is_adult: false,
    status: "active",
    joined_months_ago: 18,
    family_key: "silva",
    family_role: "child",
  },
  {
    full_name: "Sofia Silva",
    email: "sofia.silva@example.com",
    phone: "732-555-0103",
    belt_rank: "gray",
    stripes: 1,
    is_adult: false,
    status: "active",
    joined_months_ago: 14,
    family_key: "silva",
    family_role: "child",
  },

  // Family: Tanaka (parent + 1 kid)
  {
    full_name: "Hiroshi Tanaka",
    email: "h.tanaka@example.com",
    phone: "732-555-0104",
    belt_rank: "blue",
    stripes: 4,
    is_adult: true,
    status: "active",
    joined_months_ago: 20,
    family_key: "tanaka",
    family_role: "parent",
    membership_plan: "Unlimited Adult",
    custom_price: 14900, // grandfathered
  },
  {
    full_name: "Aiko Tanaka",
    email: "aiko.tanaka@example.com",
    phone: "732-555-0105",
    belt_rank: "orange",
    stripes: 0,
    is_adult: false,
    status: "active",
    joined_months_ago: 12,
    family_key: "tanaka",
    family_role: "child",
    membership_plan: "Kids Program",
  },

  // Family: O'Brien (2 parents + 1 kid)
  {
    full_name: "Patrick O'Brien",
    email: "p.obrien@example.com",
    phone: "732-555-0106",
    belt_rank: "brown",
    stripes: 1,
    is_adult: true,
    status: "active",
    joined_months_ago: 23,
    family_key: "obrien",
    family_role: "parent",
    membership_plan: "Family Plan",
  },
  {
    full_name: "Siobhan O'Brien",
    email: "s.obrien@example.com",
    phone: "732-555-0107",
    belt_rank: "blue",
    stripes: 2,
    is_adult: true,
    status: "active",
    joined_months_ago: 23,
    family_key: "obrien",
    family_role: "parent",
  },
  {
    full_name: "Liam O'Brien",
    email: "liam.obrien@example.com",
    phone: "732-555-0108",
    belt_rank: "green",
    stripes: 3,
    is_adult: false,
    status: "active",
    joined_months_ago: 16,
    family_key: "obrien",
    family_role: "child",
  },

  // Family: Patel (parent + 2 kids)
  {
    full_name: "Anika Patel",
    email: "anika.patel@example.com",
    phone: "732-555-0109",
    belt_rank: "blue",
    stripes: 1,
    is_adult: true,
    status: "active",
    joined_months_ago: 9,
    family_key: "patel",
    family_role: "parent",
    membership_plan: "Family Plan",
  },
  {
    full_name: "Arjun Patel",
    email: "arjun.patel@example.com",
    phone: "732-555-0110",
    belt_rank: "yellow",
    stripes: 4,
    is_adult: false,
    status: "active",
    joined_months_ago: 8,
    family_key: "patel",
    family_role: "child",
  },
  {
    full_name: "Maya Patel",
    email: "maya.patel@example.com",
    phone: "732-555-0111",
    belt_rank: "white",
    stripes: 2,
    is_adult: false,
    status: "trial",
    joined_months_ago: 1,
    family_key: "patel",
    family_role: "child",
  },

  // Solo adults
  {
    full_name: "Jasmine Carter",
    email: "j.carter@example.com",
    phone: "732-555-0112",
    belt_rank: "black",
    stripes: 1,
    is_adult: true,
    status: "active",
    joined_months_ago: 24,
    membership_plan: "Unlimited Adult",
  },
  {
    full_name: "Marcus Reynolds",
    email: "m.reynolds@example.com",
    phone: "732-555-0113",
    belt_rank: "purple",
    stripes: 0,
    is_adult: true,
    status: "active",
    joined_months_ago: 21,
    membership_plan: "Unlimited Adult",
  },
  {
    full_name: "Diego Hernandez",
    email: "d.hernandez@example.com",
    phone: "732-555-0114",
    belt_rank: "white",
    stripes: 4,
    is_adult: true,
    status: "active",
    joined_months_ago: 6,
    membership_plan: "Unlimited Adult",
  },
  {
    full_name: "Alex Chen",
    email: "alex.chen@example.com",
    phone: "732-555-0115",
    belt_rank: "white",
    stripes: 0,
    is_adult: true,
    status: "trial",
    joined_months_ago: 0,
    membership_plan: "Trial 30-Day",
  },
  {
    full_name: "Rebecca Hayes",
    email: "r.hayes@example.com",
    phone: "732-555-0116",
    belt_rank: "blue",
    stripes: 3,
    is_adult: true,
    status: "paused",
    joined_months_ago: 14,
  },
];

const LEADS: {
  name: string;
  email: string;
  phone: string;
  source: string;
  status: LeadStatus;
  notes: string;
  days_ago: number;
}[] = [
  {
    name: "Tyler Brooks",
    email: "tyler.b@example.com",
    phone: "732-555-0201",
    source: "Webflow Form",
    status: "new",
    notes: "Asked about kids program for 7 y/o son.",
    days_ago: 1,
  },
  {
    name: "Priya Subramaniam",
    email: "priya.s@example.com",
    phone: "732-555-0202",
    source: "Instagram",
    status: "contacted",
    notes: "Returning practitioner — purple belt, moving from FL.",
    days_ago: 3,
  },
  {
    name: "Jordan Williams",
    email: "j.williams@example.com",
    phone: "732-555-0203",
    source: "Google Search",
    status: "trial_scheduled",
    notes: "Booked free intro for Saturday 10am.",
    days_ago: 5,
  },
  {
    name: "Cameron Lee",
    email: "cam.lee@example.com",
    phone: "732-555-0204",
    source: "Walk-In",
    status: "trial_scheduled",
    notes: "Walked in Tuesday — wants nogi.",
    days_ago: 6,
  },
  {
    name: "Olivia Martin",
    email: "olivia.m@example.com",
    phone: "732-555-0205",
    source: "Referral",
    status: "lost",
    notes: "Referred by Marcus Reynolds. Missed first trial.",
    days_ago: 10,
  },
  {
    name: "Devon Robinson",
    email: "devon.r@example.com",
    phone: "732-555-0206",
    source: "Webflow Form",
    status: "contacted",
    notes: "Husband + wife inquiry, family plan.",
    days_ago: 12,
  },
  {
    name: "Sara Goldberg",
    email: "sara.g@example.com",
    phone: "732-555-0207",
    source: "Facebook Ad",
    status: "new",
    notes: "Self-defense focus.",
    days_ago: 2,
  },
];

// ─────────────────── Helpers ───────────────────

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function isoMonthsAgoDate(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

const SKILLS_BY_BELT: Record<BeltRank, number> = {
  white: 2,
  gray: 3,
  yellow: 4,
  orange: 5,
  green: 6,
  blue: 8,
  purple: 11,
  brown: 13,
  black: 15,
};

const BJJ_SKILL_IDS = [
  "hip_escape",
  "bridging",
  "technical_standup",
  "forward_roll",
  "backward_roll",
  "mount_escape",
  "side_control_escape",
  "guard_retention",
  "closed_guard_sweep",
  "armbar_from_guard",
  "triangle_from_guard",
  "rear_naked_choke",
  "kimura",
  "americana",
  "single_leg_takedown",
];

function skillsForBelt(belt: BeltRank): string[] {
  return BJJ_SKILL_IDS.slice(0, SKILLS_BY_BELT[belt]);
}

// ─────────────────── Load ───────────────────

export async function loadDemoData(): Promise<DemoActionResult> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym. Complete onboarding first." };

  // Idempotency: if any demo student already exists, bail.
  const status = await getDemoStatus();
  if (status.loaded) {
    return {
      ok: false,
      error: `Demo data already loaded (${status.studentCount} students). Reset first to reload.`,
    };
  }

  const counts: DemoCounts = {
    students: 0,
    belt_progress: 0,
    families: 0,
    leads: 0,
    plans: 0,
    memberships: 0,
  };

  // 1) Plans — upsert by name. Tag description with [DEMO DATA].
  const planByName = new Map<string, string>(); // name -> id
  for (const p of PLANS) {
    const { data: existing } = await supabase
      .from("membership_plans")
      .select("id, description")
      .eq("gym_id", gymId)
      .eq("name", p.name)
      .maybeSingle();
    if (existing) {
      planByName.set(p.name, existing.id);
      continue;
    }
    const { data: created, error: planErr } = await supabase
      .from("membership_plans")
      .insert({
        gym_id: gymId,
        name: p.name,
        price_cents: p.price_cents,
        interval: "month",
        description: `${p.description} ${DEMO_TAG}`,
      })
      .select("id")
      .single();
    if (planErr || !created) {
      return { ok: false, error: `Plan "${p.name}": ${planErr?.message}` };
    }
    planByName.set(p.name, created.id);
    counts.plans += 1;
  }

  // 2) Family accounts — one per unique family_key with a parent.
  const familyKeyToId = new Map<string, string>();
  const familyKeys = new Set(
    STUDENTS.filter((s) => s.family_key).map((s) => s.family_key!),
  );
  for (const key of familyKeys) {
    const parent =
      STUDENTS.find((s) => s.family_key === key && s.family_role === "parent") ??
      STUDENTS.find((s) => s.family_key === key);
    if (!parent) continue;
    const { data: fam, error: famErr } = await supabase
      .from("family_accounts")
      .insert({
        gym_id: gymId,
        parent_name: parent.full_name,
        parent_email: parent.email,
        parent_phone: parent.phone,
        shared_billing: true,
        notes: DEMO_TAG,
      })
      .select("id")
      .single();
    if (famErr || !fam) {
      return { ok: false, error: `Family "${key}": ${famErr?.message}` };
    }
    familyKeyToId.set(key, fam.id);
    counts.families += 1;
  }

  // 3) Students + belt_progress + memberships.
  for (const s of STUDENTS) {
    const familyId = s.family_key ? familyKeyToId.get(s.family_key) : null;
    const joinDate = isoMonthsAgoDate(s.joined_months_ago);

    const studentPayload: any = {
      gym_id: gymId,
      full_name: s.full_name,
      email: s.email,
      phone: s.phone,
      belt_rank: s.belt_rank,
      is_adult: s.is_adult,
      status: s.status,
      join_date: joinDate,
      family_account_id: familyId ?? null,
      custom_monthly_price_cents: s.custom_price ?? null,
      notes: `${DEMO_TAG} ${s.is_adult ? "Adult" : "Kid"} member${s.family_key ? ` (${s.family_key} family)` : ""}.`,
    };

    const { data: student, error: sErr } = await supabase
      .from("students")
      .insert(studentPayload)
      .select("id")
      .single();
    if (sErr || !student) {
      return { ok: false, error: `Student "${s.full_name}": ${sErr?.message}` };
    }
    counts.students += 1;

    // Belt progress
    const skills = skillsForBelt(s.belt_rank);
    const pct = Math.round((skills.length / BJJ_SKILL_IDS.length) * 100);
    const { error: bpErr } = await supabase.from("belt_progress").upsert(
      {
        student_id: student.id,
        current_belt: s.belt_rank,
        stripes: s.stripes,
        skills_completed: skills,
        progress_percentage: pct,
      },
      { onConflict: "student_id" },
    );
    if (!bpErr) counts.belt_progress += 1;

    // Membership (active) if specified
    if (s.membership_plan) {
      const planId = planByName.get(s.membership_plan);
      if (planId) {
        const { error: memErr } = await supabase.from("memberships").insert({
          student_id: student.id,
          plan_id: planId,
          custom_price_cents: s.custom_price ?? null,
          status: s.status === "trial" ? "trialing" : "active",
          start_date: joinDate,
          current_period_end: isoDaysAgo(-21), // ~3 weeks out
          cancel_at_period_end: false,
        });
        if (!memErr) counts.memberships += 1;
      }
    }
  }

  // 4) Leads
  for (const l of LEADS) {
    const { error: lErr } = await supabase.from("leads").insert({
      gym_id: gymId,
      name: l.name,
      email: l.email,
      phone: l.phone,
      source: l.source,
      status: l.status,
      notes: `${DEMO_TAG} ${l.notes}`,
      created_at: isoDaysAgo(l.days_ago),
    });
    if (!lErr) counts.leads += 1;
  }

  revalidatePath("/dashboard");
  revalidatePath("/students");
  revalidatePath("/leads");
  revalidatePath("/billing");
  revalidatePath("/checkin");

  return {
    ok: true,
    message: "Demo data loaded. Explore Students, Leads, and Check-In.",
    counts,
  };
}

// ─────────────────── Clear ───────────────────

export async function clearDemoData(): Promise<DemoActionResult> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const counts: DemoCounts = {
    students: 0,
    belt_progress: 0,
    families: 0,
    leads: 0,
    plans: 0,
    memberships: 0,
  };

  // Order: memberships → belt_progress → students → families → leads → plans.
  // Most have ON DELETE CASCADE so deleting students will cascade to
  // memberships/belt_progress/waivers/attendance, but we count things
  // explicitly so the UI can report numbers.

  // Find demo students.
  const { data: demoStudents } = await supabase
    .from("students")
    .select("id")
    .eq("gym_id", gymId)
    .ilike("notes", `%${DEMO_TAG}%`);
  const studentIds = (demoStudents ?? []).map((s: any) => s.id);

  if (studentIds.length > 0) {
    const { count: memCount } = await supabase
      .from("memberships")
      .select("id", { count: "exact", head: true })
      .in("student_id", studentIds);
    counts.memberships = memCount ?? 0;

    const { count: bpCount } = await supabase
      .from("belt_progress")
      .select("id", { count: "exact", head: true })
      .in("student_id", studentIds);
    counts.belt_progress = bpCount ?? 0;

    const { error: delStudents } = await supabase
      .from("students")
      .delete()
      .in("id", studentIds);
    if (delStudents) {
      return { ok: false, error: `Delete students: ${delStudents.message}` };
    }
    counts.students = studentIds.length;
  }

  const { data: demoFamilies } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("gym_id", gymId)
    .ilike("notes", `%${DEMO_TAG}%`);
  if ((demoFamilies ?? []).length > 0) {
    const ids = demoFamilies!.map((f: any) => f.id);
    await supabase.from("family_accounts").delete().in("id", ids);
    counts.families = ids.length;
  }

  const { data: demoLeads } = await supabase
    .from("leads")
    .select("id")
    .eq("gym_id", gymId)
    .ilike("notes", `%${DEMO_TAG}%`);
  if ((demoLeads ?? []).length > 0) {
    const ids = demoLeads!.map((l: any) => l.id);
    await supabase.from("leads").delete().in("id", ids);
    counts.leads = ids.length;
  }

  const { data: demoPlans } = await supabase
    .from("membership_plans")
    .select("id")
    .eq("gym_id", gymId)
    .ilike("description", `%${DEMO_TAG}%`);
  if ((demoPlans ?? []).length > 0) {
    const ids = demoPlans!.map((p: any) => p.id);
    // Skip any plans still referenced by non-demo memberships.
    const { data: stillUsed } = await supabase
      .from("memberships")
      .select("plan_id")
      .in("plan_id", ids);
    const usedSet = new Set((stillUsed ?? []).map((m: any) => m.plan_id));
    const safeToDelete = ids.filter((id: any) => !usedSet.has(id));
    if (safeToDelete.length > 0) {
      await supabase.from("membership_plans").delete().in("id", safeToDelete);
      counts.plans = safeToDelete.length;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/students");
  revalidatePath("/leads");
  revalidatePath("/billing");
  revalidatePath("/checkin");

  return {
    ok: true,
    message: "Demo data cleared.",
    counts,
  };
}
