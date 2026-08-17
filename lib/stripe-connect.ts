import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStripe } from "@/lib/stripe";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Helpers for charging students on a gym's connected Stripe account.
 *
 * We use DIRECT charges: every Customer / Price / Subscription is created on
 * the gym's connected Express account (via the `stripeAccount` request
 * option), so money, payouts, refunds, and disputes all live in the gym's own
 * Stripe account. MatFlow never holds funds.
 */

export type ConnectedGym = {
  id: string;
  name: string;
  stripe_account_id: string;
  billing_cadence: "anniversary" | "calendar";
  billing_anchor_day: number;
  timezone: string;
};

/**
 * Loads the gym and verifies it can accept charges on its connected account.
 * Returns a typed error string when billing isn't available.
 */
export async function requireConnectedGym(
  gymId: string,
): Promise<{ ok: true; gym: ConnectedGym; stripe: Stripe } | { ok: false; error: string }> {
  const supabase = createAdminClient() as any;
  const { data: gym } = await supabase
    .from("gyms")
    .select(
      "id, name, stripe_account_id, stripe_charges_enabled, billing_cadence, billing_anchor_day, timezone",
    )
    .eq("id", gymId)
    .maybeSingle();

  if (!gym) return { ok: false, error: "Gym not found." };
  if (!gym.stripe_account_id) {
    return {
      ok: false,
      error: "Stripe isn't connected yet. Go to Settings → Payments to connect your account.",
    };
  }
  if (!gym.stripe_charges_enabled) {
    return {
      ok: false,
      error: "Your Stripe account can't accept charges yet — finish onboarding in Settings → Payments.",
    };
  }

  return {
    ok: true,
    gym: {
      id: gym.id,
      name: gym.name,
      stripe_account_id: gym.stripe_account_id,
      billing_cadence: gym.billing_cadence === "calendar" ? "calendar" : "anniversary",
      billing_anchor_day: gym.billing_anchor_day ?? 1,
      timezone: gym.timezone ?? "America/New_York",
    },
    stripe: requireStripe(),
  };
}

/**
 * Finds or creates the Stripe Customer for a student ON the gym's connected
 * account. Caches the customer id on students.stripe_customer_id.
 */
export async function ensureConnectedCustomer(
  stripe: Stripe,
  gym: ConnectedGym,
  student: { id: string; full_name: string; email: string | null; phone: string | null; stripe_customer_id: string | null },
): Promise<string> {
  const opts = { stripeAccount: gym.stripe_account_id };

  if (student.stripe_customer_id) {
    try {
      const existing = await stripe.customers.retrieve(student.stripe_customer_id, {}, opts);
      if (!(existing as any).deleted) return student.stripe_customer_id;
    } catch {
      // Stale id (account reconnected) — fall through and create a new one.
    }
  }

  const customer = await stripe.customers.create(
    {
      name: student.full_name,
      ...(student.email ? { email: student.email } : {}),
      ...(student.phone ? { phone: student.phone } : {}),
      metadata: { matflow_student_id: student.id, matflow_gym_id: gym.id },
    },
    opts,
  );

  const supabase = createAdminClient() as any;
  await supabase
    .from("students")
    .update({ stripe_customer_id: customer.id })
    .eq("id", student.id)
    .eq("gym_id", gym.id);

  return customer.id;
}

/**
 * Finds or creates the recurring Price for a plan ON the gym's connected
 * account. Cached on membership_plans.stripe_price_id (prices are immutable
 * in Stripe, so a cached id is only reused when the amount/interval match).
 */
export async function ensureConnectedPrice(
  stripe: Stripe,
  gym: ConnectedGym,
  plan: {
    id: string;
    name: string;
    price_cents: number;
    interval: "week" | "month" | "quarter" | "year";
    stripe_product_id: string | null;
    stripe_price_id: string | null;
  },
  overrideCents?: number | null,
): Promise<string> {
  const opts = { stripeAccount: gym.stripe_account_id };
  const amountCents = overrideCents ?? plan.price_cents;
  const recurring = toRecurring(plan.interval);

  const supabase = createAdminClient() as any;

  // Reuse the cached price only for the plan's list price (custom prices
  // always get their own Price object).
  if (overrideCents == null && plan.stripe_price_id) {
    try {
      const cached = await stripe.prices.retrieve(plan.stripe_price_id, {}, opts);
      const matchesAmount =
        cached.unit_amount === amountCents &&
        cached.recurring?.interval === recurring.interval &&
        cached.recurring?.interval_count === recurring.interval_count &&
        cached.active;
      if (matchesAmount) return cached.id;
    } catch {
      // Stale id — recreate below.
    }
  }

  // Ensure a Product exists on the connected account.
  let productId: string | null = overrideCents == null ? plan.stripe_product_id : null;
  if (productId) {
    try {
      const p = await stripe.products.retrieve(productId, {}, opts);
      if (!(p as any).active) productId = null;
    } catch {
      productId = null;
    }
  }
  if (!productId) {
    const product = await stripe.products.create(
      {
        name: overrideCents == null ? plan.name : `${plan.name} (custom)`,
        metadata: { matflow_plan_id: plan.id, matflow_gym_id: gym.id },
      },
      opts,
    );
    productId = product.id;
    if (overrideCents == null) {
      await supabase
        .from("membership_plans")
        .update({ stripe_product_id: productId })
        .eq("id", plan.id)
        .eq("gym_id", gym.id);
    }
  }

  const price = await stripe.prices.create(
    {
      product: productId,
      currency: "usd",
      unit_amount: amountCents,
      recurring,
      metadata: { matflow_plan_id: plan.id, matflow_gym_id: gym.id },
    },
    opts,
  );

  if (overrideCents == null) {
    await supabase
      .from("membership_plans")
      .update({ stripe_price_id: price.id })
      .eq("id", plan.id)
      .eq("gym_id", gym.id);
  }

  return price.id;
}

function toRecurring(
  interval: "week" | "month" | "quarter" | "year",
): { interval: "week" | "month" | "year"; interval_count: number } {
  switch (interval) {
    case "week":    return { interval: "week",  interval_count: 1 };
    case "month":   return { interval: "month", interval_count: 1 };
    case "quarter": return { interval: "month", interval_count: 3 };
    case "year":    return { interval: "year",  interval_count: 1 };
  }
}

/**
 * Computes the next calendar billing anchor (a unix timestamp in the future)
 * in the gym's timezone. Used when billing_cadence = "calendar": the first
 * invoice is prorated from today until the anchor day, then bills on the
 * anchor day each period thereafter.
 *
 * Anniversary billing needs no anchor — Stripe anchors to the creation time.
 */
export function nextCalendarAnchor(gym: ConnectedGym, from = new Date()): number {
  const day = gym.billing_anchor_day;

  // Work in the gym's local calendar days.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: gym.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [y, m] = fmt.format(from).split("-").map(Number);

  // Candidate this month; if it's not strictly in the future, take next month.
  const candidate = anchorUtc(y, m, day);
  const anchor =
    candidate > Math.floor(from.getTime() / 1000)
      ? candidate
      : m === 12
        ? anchorUtc(y + 1, 1, day)
        : anchorUtc(y, m + 1, day);

  return anchor;
}

/** UTC noon on the given day — noon avoids DST edges moving it off the day. */
function anchorUtc(y: number, m: number, day: number): number {
  return Math.floor(Date.UTC(y, m - 1, day, 12, 0, 0) / 1000);
}
