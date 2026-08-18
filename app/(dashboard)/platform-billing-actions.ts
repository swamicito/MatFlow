"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { getCurrentGymId } from "@/lib/auth/current-gym";

/**
 * Opens a Stripe Billing Portal session for the gym's PLATFORM subscription
 * (the gym paying MatFlow — platform Stripe account, never Connect).
 * Used by the locked/grace screens so a gym can update its payment method.
 */
export async function createPlatformBillingPortal(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const supabase = createAdminClient() as any;
  const { data: gym } = await supabase
    .from("gyms")
    .select("platform_stripe_customer_id")
    .eq("id", gymId)
    .maybeSingle();

  if (!gym?.platform_stripe_customer_id) {
    return {
      ok: false,
      error: "No billing account on file for this gym. Contact support@mat-flow.net.",
    };
  }

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe is not configured." };

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mat-flow.net";
  const session = await stripe.billingPortal.sessions.create({
    customer: gym.platform_stripe_customer_id,
    return_url: `${site}/dashboard`,
  });

  console.log(`[platform-billing] portal session created for gym=${gymId}`);
  return { ok: true, url: session.url };
}
