"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { requirePermission } from "@/lib/auth/current-role";
import { requireStripe } from "@/lib/stripe";

// ─────────────────── Types ───────────────────

export type ConnectStatus =
  | "not_connected"   // no stripe_account_id
  | "needs_info"      // account exists, onboarding incomplete
  | "restricted"      // onboarding done, but charges not yet enabled
  | "ready";          // charges_enabled — can accept payments

export type ConnectState = {
  accountId: string | null;
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  connectedAt: string | null;
  billingCadence: "anniversary" | "calendar";
  billingAnchorDay: number;
};

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

// Always send owners back to the canonical site, never a preview URL.
const BASE_URL = "https://www.mat-flow.net";

// ─────────────────── Helpers ───────────────────

function deriveStatus(acct: {
  details_submitted?: boolean;
  charges_enabled?: boolean;
}): ConnectStatus {
  if (acct.charges_enabled) return "ready";
  if (acct.details_submitted) return "restricted";
  return "needs_info";
}

async function persistStatus(
  supabase: any,
  gymId: string,
  acct: {
    id: string;
    details_submitted?: boolean;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
  },
): Promise<void> {
  const { error } = await supabase
    .from("gyms")
    .update({
      stripe_account_id:        acct.id,
      stripe_details_submitted: acct.details_submitted ?? false,
      stripe_charges_enabled:   acct.charges_enabled ?? false,
      stripe_payouts_enabled:   acct.payouts_enabled ?? false,
      stripe_connected_at:      new Date().toISOString(),
    })
    .eq("id", gymId);
  if (error) console.error("[connect] Failed to persist account status:", error);
}

// ─────────────────── Read current state ───────────────────

export async function getConnectState(): Promise<ConnectState | null> {
  const gymId = await getCurrentGymId();
  if (!gymId) return null;

  const supabase = createAdminClient() as any;
  const { data: gym } = await supabase
    .from("gyms")
    .select(
      "stripe_account_id, stripe_details_submitted, stripe_charges_enabled, stripe_payouts_enabled, stripe_connected_at, billing_cadence, billing_anchor_day",
    )
    .eq("id", gymId)
    .maybeSingle();

  if (!gym) return null;

  const status: ConnectStatus = !gym.stripe_account_id
    ? "not_connected"
    : gym.stripe_charges_enabled
      ? "ready"
      : gym.stripe_details_submitted
        ? "restricted"
        : "needs_info";

  return {
    accountId:        gym.stripe_account_id ?? null,
    status,
    chargesEnabled:   gym.stripe_charges_enabled ?? false,
    payoutsEnabled:   gym.stripe_payouts_enabled ?? false,
    detailsSubmitted: gym.stripe_details_submitted ?? false,
    connectedAt:      gym.stripe_connected_at ?? null,
    billingCadence:   gym.billing_cadence === "calendar" ? "calendar" : "anniversary",
    billingAnchorDay: gym.billing_anchor_day ?? 1,
  };
}

// ─────────────────── Start / resume onboarding ───────────────────
// Creates an Express account for the gym if needed, then returns an Account
// Link URL the owner is redirected to for Stripe-hosted onboarding.

export async function startStripeConnect(): Promise<ActionResult<{ url: string }>> {
  const perm = await requirePermission("edit_billing");
  if (!perm.ok) return { ok: false, error: perm.error };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  let stripe;
  try {
    stripe = requireStripe();
  } catch {
    return { ok: false, error: "Stripe is not configured on this server." };
  }

  const supabase = createAdminClient() as any;
  const { data: gym } = await supabase
    .from("gyms")
    .select("name, contact_email, stripe_account_id")
    .eq("id", gymId)
    .maybeSingle();
  if (!gym) return { ok: false, error: "Gym not found." };

  try {
    let accountId = gym.stripe_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        ...(gym.contact_email ? { email: gym.contact_email } : {}),
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        business_profile: { name: gym.name },
        metadata: { matflow_gym_id: gymId },
        settings: {
          payouts: { schedule: { interval: "daily" } },
        },
      });
      accountId = account.id;

      const { error } = await supabase
        .from("gyms")
        .update({
          stripe_account_id:   accountId,
          stripe_connected_at: new Date().toISOString(),
        })
        .eq("id", gymId);
      if (error) {
        console.error("[connect] Failed to save stripe_account_id:", error);
        return { ok: false, error: "Failed to save Stripe account to gym." };
      }
    }

    const link = await stripe.accountLinks.create({
      account:     accountId,
      refresh_url: `${BASE_URL}/settings/connect?refresh=1`,
      return_url:  `${BASE_URL}/settings/connect?return=1`,
      type:        "account_onboarding",
    });

    return { ok: true, data: { url: link.url } };
  } catch (e) {
    console.error("[connect] startStripeConnect failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to start Stripe onboarding.",
    };
  }
}

// ─────────────────── Sync status from Stripe ───────────────────
// Called when the owner returns from Stripe onboarding (and on page load) to
// refresh the capability flags stored on the gym row.

export async function syncConnectStatus(): Promise<ActionResult<ConnectState>> {
  const perm = await requirePermission("view_billing");
  if (!perm.ok) return { ok: false, error: perm.error };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const supabase = createAdminClient() as any;
  const { data: gym } = await supabase
    .from("gyms")
    .select("stripe_account_id, billing_cadence, billing_anchor_day")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym?.stripe_account_id) {
    return {
      ok: true,
      data: {
        accountId: null, status: "not_connected",
        chargesEnabled: false, payoutsEnabled: false,
        detailsSubmitted: false, connectedAt: null,
        billingCadence: "anniversary", billingAnchorDay: 1,
      },
    };
  }

  try {
    const stripe = requireStripe();
    const acct = await stripe.accounts.retrieve(gym.stripe_account_id);
    await persistStatus(supabase, gymId, acct);

    return {
      ok: true,
      data: {
        accountId:        acct.id,
        status:           deriveStatus(acct),
        chargesEnabled:   acct.charges_enabled ?? false,
        payoutsEnabled:   acct.payouts_enabled ?? false,
        detailsSubmitted: acct.details_submitted ?? false,
        connectedAt:      new Date().toISOString(),
        billingCadence:   gym.billing_cadence === "calendar" ? "calendar" : "anniversary",
        billingAnchorDay: gym.billing_anchor_day ?? 1,
      },
    };
  } catch (e) {
    console.error("[connect] syncConnectStatus failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to sync Stripe status.",
    };
  }
}

// ─────────────────── Express dashboard login link ───────────────────

export async function createExpressDashboardLink(): Promise<ActionResult<{ url: string }>> {
  const perm = await requirePermission("edit_billing");
  if (!perm.ok) return { ok: false, error: perm.error };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const supabase = createAdminClient() as any;
  const { data: gym } = await supabase
    .from("gyms")
    .select("stripe_account_id")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym?.stripe_account_id) {
    return { ok: false, error: "No Stripe account connected yet." };
  }

  try {
    const stripe = requireStripe();
    const link = await stripe.accounts.createLoginLink(gym.stripe_account_id);
    return { ok: true, data: { url: link.url } };
  } catch (e) {
    console.error("[connect] createExpressDashboardLink failed:", e);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create dashboard link.",
    };
  }
}

// ─────────────────── Billing cadence ───────────────────
// Anniversary: each student bills on their join date.
// Calendar:    everyone bills on the same day of month (first invoice prorated).

export async function setBillingCadence(input: {
  cadence: "anniversary" | "calendar";
  anchorDay?: number;
}): Promise<ActionResult> {
  const perm = await requirePermission("edit_billing");
  if (!perm.ok) return { ok: false, error: perm.error };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  if (input.cadence !== "anniversary" && input.cadence !== "calendar") {
    return { ok: false, error: "Invalid cadence." };
  }
  const anchorDay =
    input.cadence === "calendar" ? Math.round(input.anchorDay ?? 1) : 1;
  if (anchorDay < 1 || anchorDay > 28) {
    return { ok: false, error: "Billing day must be between 1 and 28." };
  }

  const supabase = createAdminClient() as any;
  const { data: gym } = await supabase
    .from("gyms")
    .select("stripe_charges_enabled")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym?.stripe_charges_enabled) {
    return { ok: false, error: "Connect Stripe and get approved for charges first." };
  }

  const { error } = await supabase
    .from("gyms")
    .update({ billing_cadence: input.cadence, billing_anchor_day: anchorDay })
    .eq("id", gymId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/connect");
  revalidatePath("/billing");
  return { ok: true };
}
