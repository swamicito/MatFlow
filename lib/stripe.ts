import "server-only";
import Stripe from "stripe";
import type { MembershipInterval, MembershipStatus } from "@/lib/supabase/types";

/**
 * Returns true if `STRIPE_SECRET_KEY` looks like a real Stripe key, not a
 * placeholder copied from `.env.local.example`.
 */
export function isStripeConfigured(): boolean {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return false;
  // Reject obvious placeholders. Real keys are `sk_test_` / `sk_live_` followed
  // by ~100 chars of random hex.
  if (!/^sk_(test|live)_/.test(key)) return false;
  if (/your[_-]?key|placeholder|xxx/i.test(key)) return false;
  if (key.length < 30) return false;
  return true;
}

/**
 * Returns a configured Stripe client, or null if `STRIPE_SECRET_KEY` is not
 * set (or is still the placeholder from `.env.local.example`). The rest of
 * the app degrades gracefully — plan CRUD still works (Supabase only) and any
 * Stripe-touching action returns a clear error.
 */
export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    typescript: true,
    appInfo: { name: "MatFlow" },
  });
}

export function requireStripe(): Stripe {
  const s = getStripe();
  if (!s) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local.",
    );
  }
  return s;
}

/**
 * Map our compact interval enum to the Stripe recurring price shape.
 */
export function toStripeRecurring(
  interval: MembershipInterval,
): { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number } {
  switch (interval) {
    case "week":
      return { interval: "week", interval_count: 1 };
    case "month":
      return { interval: "month", interval_count: 1 };
    case "quarter":
      return { interval: "month", interval_count: 3 };
    case "year":
      return { interval: "year", interval_count: 1 };
  }
}

/**
 * Stripe subscription status → our DB enum.
 */
export function stripeStatusToDb(
  status: Stripe.Subscription.Status,
): MembershipStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "paused":
      return "paused";
    case "past_due":
    case "unpaid":
    case "incomplete":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "canceled";
    default:
      return "past_due";
  }
}
