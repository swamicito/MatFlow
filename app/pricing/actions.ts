"use server";

import { redirect } from "next/navigation";
import { requireStripe } from "@/lib/stripe";

// Always use the canonical production domain for Stripe redirect URLs so the
// user lands on the real site regardless of which deployment created the session.
const CHECKOUT_BASE_URL = "https://www.mat-flow.net";

export type PricingPlan = "starter" | "pro" | "growth";
export type BillingInterval = "monthly" | "annual";

export type SignupInfo = {
  gymName: string;
  ownerName: string;
  ownerEmail: string;
};

// ─── Stripe Price IDs ─────────────────────────────────────────────────────────
// Create these products in your Stripe dashboard (see instructions below), then
// add the Price IDs to your Vercel environment variables.
const PRICE_IDS: Record<string, string> = {
  starter_monthly: process.env.MF_PRICE_STARTER_MONTHLY ?? "",
  starter_annual:  process.env.MF_PRICE_STARTER_ANNUAL  ?? "",
  pro_monthly:     process.env.MF_PRICE_PRO_MONTHLY     ?? "",
  pro_annual:      process.env.MF_PRICE_PRO_ANNUAL      ?? "",
  growth_monthly:  process.env.MF_PRICE_GROWTH_MONTHLY  ?? "",
  growth_annual:   process.env.MF_PRICE_GROWTH_ANNUAL   ?? "",
  onboarding:      process.env.MF_PRICE_ONBOARDING      ?? "",
};

// NOTE: The optional $399 onboarding fee is NOT included in the initial
// checkout — it requires a payment method and is offered post-trial via a
// separate invoice. Annual plans have it waived as an incentive.
export async function createPlatformCheckoutSession(
  plan: PricingPlan,
  interval: BillingInterval,
  info: SignupInfo,
): Promise<{ ok: false; error: string }> {
  const priceId = PRICE_IDS[`${plan}_${interval}`];

  if (!priceId) {
    return {
      ok: false,
      error: `Stripe price not configured for ${plan} (${interval}). Set MF_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()} in your environment.`,
    };
  }

  let stripe;
  try {
    stripe = requireStripe();
  } catch {
    return { ok: false, error: "Stripe is not configured on this server." };
  }

  const lineItems: { price: string; quantity: number }[] = [
    { price: priceId, quantity: 1 },
  ];

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: info.ownerEmail,
      line_items: lineItems,
      subscription_data: {
        trial_period_days: 30,
        // Auto-cancel when trial ends if no payment method was added.
        trial_settings: {
          end_behavior: { missing_payment_method: "cancel" },
        },
        metadata: {
          matflow_plan: plan,
          matflow_purchase_type: "platform_subscription",
          gym_name: info.gymName,
          owner_name: info.ownerName,
          owner_email: info.ownerEmail,
        },
      },
      // Require a card even though $0 is due today (trial) — otherwise the
      // subscription starts with no payment method and there's nothing to
      // charge when the trial ends. The trial_settings cancel behavior above
      // is now just a safety net; with a card on file it never triggers.
      payment_method_collection: "always",
      allow_promotion_codes: true,
      // Redirect to confirmation page — gym is provisioned manually.
      success_url: `${CHECKOUT_BASE_URL}/signup/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${CHECKOUT_BASE_URL}/pricing`,
      metadata: {
        matflow_plan: plan,
        matflow_interval: interval,
        matflow_purchase_type: "platform_subscription",
        gym_name: info.gymName,
        owner_name: info.ownerName,
        owner_email: info.ownerEmail,
      },
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to create checkout session.",
    };
  }

  if (!session.url) {
    return { ok: false, error: "Stripe did not return a checkout URL." };
  }

  redirect(session.url);
}
