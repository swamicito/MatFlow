"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { INTERVALS } from "@/lib/billing";

/* eslint-disable @typescript-eslint/no-explicit-any */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function isStripeError(e: unknown): e is { message: string } {
  return typeof e === "object" && e !== null && "message" in e;
}

function err(e: unknown): string {
  if (isStripeError(e)) return e.message;
  return "Unexpected error.";
}

function validatePlan(input: any): string | null {
  if (!input.name?.trim()) return "Name is required.";
  if (!Number.isFinite(input.price_cents) || input.price_cents < 0) {
    return "Price must be a non-negative integer (in cents).";
  }
  if (!INTERVALS.includes(input.interval)) return "Invalid interval.";
  return null;
}

// =====================================================
// Plan CRUD
// =====================================================

export async function createPlan(input: any): Promise<ActionResult> {
  const v = validatePlan(input);
  if (v) return { ok: false, error: v };

  try {
    const supabase = createAdminClient() as any;
    const gymId = await getCurrentGymId();
    if (!gymId) return { ok: false, error: "No active gym" };

    const { error } = await supabase.from("membership_plans").insert({
      gym_id: gymId,
      name: input.name.trim(),
      price_cents: Math.round(input.price_cents),
      interval: input.interval,
      description: input.description?.trim() || null,
    });

    if (error) return { ok: false, error: error.message };

    revalidatePath("/billing/plans");
    revalidatePath("/billing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function updatePlan(id: string, input: any): Promise<ActionResult> {
  const v = validatePlan(input);
  if (v) return { ok: false, error: v };

  try {
    const supabase = createAdminClient() as any;

    // ── Ownership pre-check ──────────────────────────────────────────────────
    // membership_plans rows are scoped to a gym.  Without this check, any
    // caller who knows a plan UUID can reprice or rename a plan at another
    // gym — directly affecting what that gym's members are billed.
    const gymId = await getCurrentGymId();
    if (!gymId) return { ok: false, error: "No active gym." };

    const { data: owned } = await supabase
      .from("membership_plans")
      .select("id")
      .eq("id", id)
      .eq("gym_id", gymId)
      .maybeSingle();

    if (!owned) {
      return { ok: false, error: "Plan not found or does not belong to this gym." };
    }
    // ────────────────────────────────────────────────────────────────────────

    const { error } = await supabase
      .from("membership_plans")
      .update({
        name: input.name.trim(),
        price_cents: Math.round(input.price_cents),
        interval: input.interval,
        description: input.description?.trim() || null,
      })
      .eq("id", id)
      .eq("gym_id", gymId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/billing/plans");
    revalidatePath("/billing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

export async function deletePlan(id: string): Promise<ActionResult> {
  try {
    const supabase = createAdminClient() as any;

    // ── Ownership pre-check ──────────────────────────────────────────────────
    // Deleting a plan at another gym removes the pricing tier that their
    // active subscriptions may reference — cascading into billing failures.
    // Hard-block if the plan doesn't belong to the current gym.
    const gymId = await getCurrentGymId();
    if (!gymId) return { ok: false, error: "No active gym." };

    const { data: owned } = await supabase
      .from("membership_plans")
      .select("id")
      .eq("id", id)
      .eq("gym_id", gymId)
      .maybeSingle();

    if (!owned) {
      return { ok: false, error: "Plan not found or does not belong to this gym." };
    }
    // ────────────────────────────────────────────────────────────────────────

    const { error } = await supabase
      .from("membership_plans")
      .delete()
      .eq("id", id)
      .eq("gym_id", gymId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/billing/plans");
    revalidatePath("/billing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: err(e) };
  }
}

// =====================================================
// Subscription functions (placeholders)
// =====================================================

export async function subscribeStudent(input: any): Promise<ActionResult> {
  return { ok: false, error: "Not implemented yet" };
}

export async function cancelSubscription(membership_id: string, immediate = false): Promise<ActionResult> {
  return { ok: false, error: "Not implemented yet" };
}

export async function retryPayment(membership_id: string): Promise<ActionResult> {
  return { ok: false, error: "Not implemented yet" };
}

export async function createPortalSession(student_id: string, return_url: string): Promise<ActionResult<{ url: string }>> {
  return { ok: false, error: "Not implemented yet" };
}