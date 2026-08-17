"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { requirePermission } from "@/lib/auth/current-role";
import { INTERVALS } from "@/lib/billing";
import { stripeStatusToDb } from "@/lib/stripe";
import {
  ensureConnectedCustomer,
  ensureConnectedPrice,
  nextCalendarAnchor,
  requireConnectedGym,
} from "@/lib/stripe-connect";

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
// Subscriptions — direct charges on the gym's connected account
// =====================================================

/**
 * Puts a student on a paid plan: ensures a Stripe Customer + Price exist on
 * the gym's connected account, then creates a Subscription.
 *
 * Billing cadence:
 *  - anniversary: Stripe anchors the cycle to today (default behavior).
 *  - calendar:    first invoice is prorated until the gym's anchor day, then
 *                 bills on that day every period.
 *
 * The first invoice is sent to the student by email (send_invoice) — no card
 * is collected up front. Once the student pays, future invoices auto-charge
 * the saved card (Stripe does this automatically when the invoice's payment
 * method is saved).
 */
export async function subscribeStudent(input: any): Promise<ActionResult> {
  const perm = await requirePermission("edit_billing");
  if (!perm.ok) return { ok: false, error: perm.error };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const conn = await requireConnectedGym(gymId);
  if (!conn.ok) return { ok: false, error: conn.error };
  const { gym, stripe } = conn;
  const opts = { stripeAccount: gym.stripe_account_id };

  const supabase = createAdminClient() as any;

  const [{ data: student }, { data: plan }] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, email, phone, stripe_customer_id")
      .eq("id", input.student_id)
      .eq("gym_id", gymId)
      .maybeSingle(),
    supabase
      .from("membership_plans")
      .select("id, name, price_cents, interval, stripe_product_id, stripe_price_id")
      .eq("id", input.plan_id)
      .eq("gym_id", gymId)
      .maybeSingle(),
  ]);

  if (!student) return { ok: false, error: "Student not found." };
  if (!plan) return { ok: false, error: "Plan not found." };

  const customCents =
    input.custom_price_cents != null && Number.isFinite(input.custom_price_cents)
      ? Math.round(input.custom_price_cents)
      : null;
  if (customCents !== null && customCents < 0) {
    return { ok: false, error: "Custom price must be non-negative." };
  }

  // One active membership at a time — refuse rather than double-billing.
  const { data: existing } = await supabase
    .from("memberships")
    .select("id, status")
    .eq("student_id", student.id)
    .in("status", ["active", "trialing", "past_due", "pending"])
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: `Student already has a ${existing.status} membership. Cancel it first.`,
    };
  }

  const effectiveCents = customCents ?? plan.price_cents;

  try {
    // ── Free / $0 plan: no Stripe subscription at all ────────────────────────
    // Nothing to collect, so the membership is a Trial rather than Active.
    if (effectiveCents === 0) {
      const { error: insErr } = await supabase.from("memberships").insert({
        student_id: student.id,
        plan_id: plan.id,
        custom_price_cents: customCents,
        stripe_subscription_id: null,
        stripe_price_id: null,
        status: "trialing",
        start_date: new Date().toISOString().slice(0, 10),
        current_period_end: null,
        cancel_at_period_end: false,
      });
      if (insErr) return { ok: false, error: `Failed to save membership: ${insErr.message}` };

      revalidatePath("/billing");
      revalidatePath("/students");
      return { ok: true };
    }

    // ── Paid plan: subscription on the connected account ─────────────────────
    const customerId = await ensureConnectedCustomer(stripe, gym, student);
    const priceId = await ensureConnectedPrice(stripe, gym, plan, customCents);

    const isCalendar = gym.billing_cadence === "calendar";
    const subscription = await stripe.subscriptions.create(
      {
        customer: customerId,
        items: [{ price: priceId }],
        collection_method: "send_invoice",
        days_until_due: 7,
        expand: ["latest_invoice"],
        ...(isCalendar
          ? {
              billing_cycle_anchor: nextCalendarAnchor(gym),
              proration_behavior: "create_prorations",
            }
          : {}),
        metadata: {
          matflow_gym_id: gym.id,
          matflow_student_id: student.id,
          matflow_plan_id: plan.id,
        },
      },
      opts,
    );

    const periodEndUnix = (subscription as any).items?.data?.[0]?.current_period_end ?? null;

    // With collection_method=send_invoice, Stripe marks the subscription
    // "active" immediately even though the first invoice is unpaid. Trust the
    // invoice, not the subscription status: only mark Active once the first
    // invoice is actually paid (otherwise invoice.paid will flip it later).
    const latestInvoice = subscription.latest_invoice as { status?: string } | null;
    const firstInvoicePaid = latestInvoice?.status === "paid";

    const { error: insErr } = await supabase.from("memberships").insert({
      student_id: student.id,
      plan_id: plan.id,
      custom_price_cents: customCents,
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      status: firstInvoicePaid ? "active" : "pending",
      start_date: new Date().toISOString().slice(0, 10),
      current_period_end: periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null,
      cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    });
    if (insErr) {
      // Roll back the Stripe subscription so we never double-bill later.
      await stripe.subscriptions.cancel(subscription.id, {}, opts).catch(() => {});
      return { ok: false, error: `Failed to save membership: ${insErr.message}` };
    }

    revalidatePath("/billing");
    revalidatePath("/students");
    return { ok: true };
  } catch (e) {
    console.error("[billing] subscribeStudent failed:", e);
    return { ok: false, error: err(e) };
  }
}

/**
 * Cancels the student's subscription on the gym's connected account.
 * Default: cancel at period end. immediate=true cancels right now.
 */
export async function cancelSubscription(
  membership_id: string,
  immediate = false,
): Promise<ActionResult> {
  const perm = await requirePermission("edit_billing");
  if (!perm.ok) return { ok: false, error: perm.error };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const conn = await requireConnectedGym(gymId);
  if (!conn.ok) return { ok: false, error: conn.error };
  const { gym, stripe } = conn;
  const opts = { stripeAccount: gym.stripe_account_id };

  const supabase = createAdminClient() as any;

  // Scope through students so a caller can't cancel another gym's membership.
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, stripe_subscription_id, students!inner(gym_id)")
    .eq("id", membership_id)
    .maybeSingle();
  if (!membership || (membership as any).students?.gym_id !== gymId) {
    return { ok: false, error: "Membership not found." };
  }

  try {
    if (membership.stripe_subscription_id) {
      if (immediate) {
        await stripe.subscriptions.cancel(membership.stripe_subscription_id, {}, opts);
        await supabase
          .from("memberships")
          .update({ status: "canceled", cancel_at_period_end: false })
          .eq("id", membership.id);
      } else {
        await stripe.subscriptions.update(
          membership.stripe_subscription_id,
          { cancel_at_period_end: true },
          opts,
        );
        await supabase
          .from("memberships")
          .update({ cancel_at_period_end: true })
          .eq("id", membership.id);
      }
    } else {
      // No Stripe subscription (manual membership) — just close the record.
      await supabase
        .from("memberships")
        .update({ status: "canceled", cancel_at_period_end: false })
        .eq("id", membership.id);
    }

    revalidatePath("/billing");
    revalidatePath("/students");
    return { ok: true };
  } catch (e) {
    console.error("[billing] cancelSubscription failed:", e);
    return { ok: false, error: err(e) };
  }
}

/**
 * Re-sends the latest open invoice for a past-due membership. With the
 * send_invoice flow, this is how staff nudge a student to pay.
 */
export async function retryPayment(membership_id: string): Promise<ActionResult> {
  const perm = await requirePermission("edit_billing");
  if (!perm.ok) return { ok: false, error: perm.error };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const conn = await requireConnectedGym(gymId);
  if (!conn.ok) return { ok: false, error: conn.error };
  const { gym, stripe } = conn;
  const opts = { stripeAccount: gym.stripe_account_id };

  const supabase = createAdminClient() as any;
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, status, stripe_subscription_id, students!inner(gym_id)")
    .eq("id", membership_id)
    .maybeSingle();
  if (!membership || (membership as any).students?.gym_id !== gymId) {
    return { ok: false, error: "Membership not found." };
  }
  if (!membership.stripe_subscription_id) {
    return { ok: false, error: "This membership isn't linked to Stripe." };
  }

  try {
    const invoices = await stripe.invoices.list(
      { subscription: membership.stripe_subscription_id, status: "open", limit: 1 },
      opts,
    );
    const open = invoices.data[0];
    if (!open) {
      return { ok: false, error: "No open invoice to retry — the student may already be up to date." };
    }
    await stripe.invoices.sendInvoice(open.id, {}, opts);

    revalidatePath("/billing");
    return { ok: true };
  } catch (e) {
    console.error("[billing] retryPayment failed:", e);
    return { ok: false, error: err(e) };
  }
}

/**
 * Opens a Stripe customer portal session (hosted by Stripe, on the gym's
 * connected account) so the student can update their card / view invoices.
 */
export async function createPortalSession(
  student_id: string,
  return_url: string,
): Promise<ActionResult<{ url: string }>> {
  const perm = await requirePermission("edit_billing");
  if (!perm.ok) return { ok: false, error: perm.error };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const conn = await requireConnectedGym(gymId);
  if (!conn.ok) return { ok: false, error: conn.error };
  const { gym, stripe } = conn;

  const supabase = createAdminClient() as any;
  const { data: student } = await supabase
    .from("students")
    .select("id, stripe_customer_id")
    .eq("id", student_id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!student) return { ok: false, error: "Student not found." };
  if (!student.stripe_customer_id) {
    return { ok: false, error: "This student has no Stripe customer yet — subscribe them to a plan first." };
  }

  // Only allow returns to mat-flow.net so this can't be used as an open redirect.
  const safeReturn =
    typeof return_url === "string" && return_url.startsWith("https://www.mat-flow.net")
      ? return_url
      : "https://www.mat-flow.net/students";

  try {
    const session = await stripe.billingPortal.sessions.create(
      { customer: student.stripe_customer_id, return_url: safeReturn },
      { stripeAccount: gym.stripe_account_id },
    );
    return { ok: true, data: { url: session.url } };
  } catch (e) {
    console.error("[billing] createPortalSession failed:", e);
    return { ok: false, error: err(e) };
  }
}