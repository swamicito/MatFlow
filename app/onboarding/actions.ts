/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import type { Database, MembershipInterval } from "@/lib/supabase/types";

// ─────────────────── State (read) ───────────────────

export type OnboardingState = {
  gym: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    timezone: string;
    onboarding_completed: boolean;
    webhook_last_test_at: string | null;
  };
  plans: {
    id: string;
    name: string;
    price_cents: number;
    interval: MembershipInterval;
    description: string | null;
  }[];
  hasStudents: boolean;
  hasDemoData: boolean;
};

export async function getOnboardingState(): Promise<OnboardingState | null> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return null;

  // Try the full select first; fall back to legacy columns if migration 0004
  // hasn't been applied yet so the wizard can still bootstrap a fresh DB.
  async function fetchGym() {
    const full = await supabase
      .from("gyms")
      .select(
        "id, name, address, phone, timezone, onboarding_completed, webhook_last_test_at",
      )
      .eq("id", gymId!)
      .maybeSingle();
    if (!full.error && full.data) return { data: full.data, error: null };
    const legacy = await supabase
      .from("gyms")
      .select("id, name")
      .eq("id", gymId!)
      .maybeSingle();
    if (legacy.error || !legacy.data) {
      return { data: null, error: legacy.error ?? full.error };
    }
    return {
      data: {
        id: legacy.data.id,
        name: legacy.data.name,
        address: null,
        phone: null,
        timezone: "America/New_York",
        onboarding_completed: false,
        webhook_last_test_at: null,
      },
      error: null,
    };
  }

  const [gymRes, plansRes, studentsCountRes, demoCountRes] = await Promise.all([
    fetchGym(),
    supabase
      .from("membership_plans")
      .select("id, name, price_cents, interval, description")
      .eq("gym_id", gymId)
      .order("price_cents", { ascending: false }),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId),
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId)
      .ilike("notes", "%[DEMO DATA]%"),
  ]);

  if (gymRes.error || !gymRes.data) return null;

  return {
    gym: gymRes.data,
    plans: plansRes.data ?? [],
    hasStudents: (studentsCountRes.count ?? 0) > 0,
    hasDemoData: (demoCountRes.count ?? 0) > 0,
  };
}

// ─────────────────── Step 1: Gym basics ───────────────────

export type SaveGymBasicsInput = {
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string;
};

export async function saveGymBasics(
  input: SaveGymBasicsInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Gym name is required." };
  if (!input.timezone) return { ok: false, error: "Timezone is required." };

  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { error } = await supabase
    .from("gyms")
    .update({
      name,
      address: input.address?.trim() || null,
      phone: input.phone?.trim() || null,
      timezone: input.timezone,
    })
    .eq("id", gymId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ─────────────────── Step 2: Plans ───────────────────

export type PlanDraft = {
  id?: string; // existing plan id, if editing
  name: string;
  price_cents: number;
  interval: MembershipInterval;
  description: string | null;
};

export async function saveOnboardingPlans(
  plans: PlanDraft[],
): Promise<{ ok: true; created: number; updated: number } | { ok: false; error: string }> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const cleaned = plans
    .map((p) => ({
      ...p,
      name: p.name.trim(),
      description: p.description?.trim() || null,
    }))
    .filter((p) => p.name.length > 0 && Number.isFinite(p.price_cents) && p.price_cents >= 0);

  if (cleaned.length === 0) {
    return { ok: false, error: "Add at least one plan with a name and price." };
  }

  let created = 0;
  let updated = 0;

  for (const p of cleaned) {
    if (p.id) {
      const { error } = await supabase
        .from("membership_plans")
        .update({
          name: p.name,
          price_cents: p.price_cents,
          interval: p.interval,
          description: p.description,
        })
        .eq("id", p.id)
        .eq("gym_id", gymId);
      if (error) return { ok: false, error: `Update "${p.name}": ${error.message}` };
      updated += 1;
    } else {
      const payload: any = {
        gym_id: gymId,
        name: p.name,
        price_cents: p.price_cents,
        interval: p.interval,
        description: p.description,
      };
      const { error } = await supabase.from("membership_plans").insert(payload);
      if (error) return { ok: false, error: `Create "${p.name}": ${error.message}` };
      created += 1;
    }
  }

  revalidatePath("/onboarding");
  revalidatePath("/billing/plans");
  return { ok: true, created, updated };
}

export async function deleteOnboardingPlan(
  planId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  // Refuse to delete plans that already have memberships attached.
  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "This plan has active memberships and can't be deleted from onboarding.",
    };
  }

  const { error } = await supabase
    .from("membership_plans")
    .delete()
    .eq("id", planId)
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding");
  return { ok: true };
}

// ─────────────────── Step 5: Webhook test ───────────────────

export async function testWebhook(): Promise<
  | { ok: true; message: string; lead_id: string | null }
  | { ok: false; error: string }
> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  // Insert a synthetic lead exactly like the Webflow webhook would.
  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      gym_id: gymId,
      name: "Webhook Test",
      email: `webhook-test-${Date.now()}@example.com`,
      phone: "555-000-0000",
      source: "Webhook Test",
      status: "new",
      notes: "[ONBOARDING] Generated by 'Test Webhook' button.",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  await supabase
    .from("gyms")
    .update({ webhook_last_test_at: new Date().toISOString() })
    .eq("id", gymId);

  revalidatePath("/onboarding");
  revalidatePath("/leads");
  return {
    ok: true,
    message: "Test lead inserted. Open /leads to see it.",
    lead_id: lead?.id ?? null,
  };
}

// ─────────────────── Step 6: Finish ───────────────────

export async function completeOnboarding(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { error } = await supabase
    .from("gyms")
    .update({ onboarding_completed: true })
    .eq("id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { ok: true };
}

export async function resetOnboarding(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { error } = await supabase
    .from("gyms")
    .update({ onboarding_completed: false })
    .eq("id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/onboarding");
  revalidatePath("/settings");
  return { ok: true };
}
