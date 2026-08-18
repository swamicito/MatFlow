/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Platform billing gate — controls whether a gym's STAFF DASHBOARD is usable
 * based on the gym's subscription to MatFlow itself (not student memberships).
 *
 * Policy (documented):
 *  - billing_exempt gyms        → always full access (complimentary accounts).
 *  - null status (legacy gyms)  → full access — predates platform billing.
 *  - trialing / active          → full access.
 *  - past_due                   → 7-day grace (banner), then LOCKED.
 *  - canceled / unpaid          → full access until current_period_end, then LOCKED.
 *  - LOCKED                     → dashboard replaced by a payment-update screen;
 *                                 only /settings/billing stays reachable.
 *  - Student portal (/portal)   → intentionally NOT gated. Students pay the
 *                                 gym, not MatFlow — locking them out punishes
 *                                 the wrong party and generates support load.
 *                                 This is a deliberate product decision.
 */

export type PlatformBillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid";

export type PlatformGate =
  | { state: "full" }
  | { state: "grace"; daysLeft: number; periodEnd: string | null }
  | { state: "locked"; status: "past_due" | "canceled" | "unpaid" };

export const PAST_DUE_GRACE_DAYS = 7;

type GymBillingRow = {
  platform_subscription_status: PlatformBillingStatus | null;
  platform_current_period_end: string | null;
  platform_past_due_since: string | null;
  billing_exempt: boolean;
};

export function computePlatformGate(
  row: GymBillingRow,
  now = new Date(),
): PlatformGate {
  if (row.billing_exempt) return { state: "full" };
  const status = row.platform_subscription_status;
  if (!status || status === "trialing" || status === "active") {
    return { state: "full" };
  }

  if (status === "past_due") {
    const since = row.platform_past_due_since
      ? new Date(row.platform_past_due_since)
      : now;
    const graceEnds = new Date(
      since.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000,
    );
    if (now < graceEnds) {
      const daysLeft = Math.max(
        1,
        Math.ceil((graceEnds.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      );
      return { state: "grace", daysLeft, periodEnd: row.platform_current_period_end };
    }
    return { state: "locked", status };
  }

  // canceled / unpaid — access until the period they paid for ends.
  if (row.platform_current_period_end && now < new Date(row.platform_current_period_end)) {
    return { state: "full" };
  }
  return { state: "locked", status };
}

/** Fetch the billing-relevant gym columns and compute the gate. */
export async function getPlatformGate(gymId: string): Promise<PlatformGate> {
  try {
    const supabase = createAdminClient() as any;
    const { data } = await supabase
      .from("gyms")
      .select(
        "platform_subscription_status, platform_current_period_end, platform_past_due_since, billing_exempt",
      )
      .eq("id", gymId)
      .maybeSingle();
    if (!data) return { state: "full" };
    const gate = computePlatformGate(data as GymBillingRow);
    if (gate.state !== "full") {
      console.log(
        `[platform-billing] gate=${gate.state} gym=${gymId} status=${data.platform_subscription_status}`,
      );
    }
    return gate;
  } catch (err) {
    // Fail OPEN — a transient DB error must not lock paying customers out.
    console.error(`[platform-billing] gate lookup failed for gym=${gymId} (failing open):`, err);
    return { state: "full" };
  }
}

// ─── Webhook-side status application ────────────────────────────────────────

function stripeSubStatusToPlatform(s: string): PlatformBillingStatus {
  switch (s) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    case "unpaid":
    case "incomplete":
      return "unpaid";
    default:
      return "active";
  }
}

/**
 * Find the gym that owns this Stripe subscription. Only matches subscriptions
 * recorded as the gym's PLATFORM subscription — never student memberships.
 */
export async function findGymByPlatformSubscription(
  supabase: any,
  stripeSubscriptionId: string,
): Promise<{ id: string; platform_subscription_status: PlatformBillingStatus | null } | null> {
  const { data } = await supabase
    .from("gyms")
    .select("id, platform_subscription_status")
    .eq("platform_stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();
  return data ?? null;
}

/** Persist a platform subscription status change on the gym row. */
export async function applyPlatformSubscriptionStatus(
  supabase: any,
  gymId: string,
  stripeStatus: string,
  periodEndUnix: number | null | undefined,
): Promise<void> {
  const status = stripeSubStatusToPlatform(stripeStatus);

  const patch: Record<string, unknown> = {
    platform_subscription_status: status,
    platform_current_period_end: periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : null,
  };
  // Track when past_due started (for the grace window); clear it on recovery.
  if (status === "past_due") {
    const { data: current } = await supabase
      .from("gyms")
      .select("platform_past_due_since")
      .eq("id", gymId)
      .maybeSingle();
    patch.platform_past_due_since = current?.platform_past_due_since ?? new Date().toISOString();
  } else {
    patch.platform_past_due_since = null;
  }

  const { error } = await supabase.from("gyms").update(patch).eq("id", gymId);
  if (error) {
    console.error(`[platform-billing] FAILED to set gym=${gymId} status=${status}:`, error.message);
    throw new Error(`platform status update failed: ${error.message}`);
  }
  console.log(`[platform-billing] gym=${gymId} status → ${status} (stripe=${stripeStatus})`);
}
