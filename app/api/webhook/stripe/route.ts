/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, stripeStatusToDb } from "@/lib/stripe";
import { fulfillCheckoutSession } from "@/app/(dashboard)/settings/sell/actions";
import { fulfillInstructionalCheckout } from "@/app/(dashboard)/settings/ondemand/actions";
import { provisionPlatformGym } from "@/lib/platform/provision";

export const runtime = "nodejs"; // need Node crypto for signature verification
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

async function applySubscriptionUpdate(sub: Stripe.Subscription) {
  const supabase = createAdminClient() as any;
  const periodEndUnix = sub.items.data[0]?.current_period_end;

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, status")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (!membership) return;

  let status = stripeStatusToDb(sub.status);

  // With collection_method=send_invoice, Stripe reports the subscription as
  // "active" from creation even though the first invoice is unpaid. Only
  // invoice.paid may move a pending membership to active — don't let a bare
  // subscription update do it.
  if (membership.status === "pending" && status === "active") {
    status = "pending";
  }

  await supabase
    .from("memberships")
    .update({
      status,
      current_period_end: periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
    })
    .eq("id", membership.id);
}

async function applyInvoicePaid(invoice: Stripe.Invoice) {
  const subId = (invoice as unknown as { subscription?: string }).subscription;
  if (!subId) return;
  const supabase = createAdminClient() as any;

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, status")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!membership) return;

  // A paid invoice settles any money owed: pending (first payment) and
  // past_due (failed renewal) both become active. Exception: a $0 invoice
  // during a real Stripe trial must not end the trial early.
  const keepTrial =
    membership.status === "trialing" && (invoice.amount_paid ?? 0) === 0;

  const periodEndUnix = invoice.lines.data[0]?.period?.end;
  await supabase
    .from("memberships")
    .update({
      status: keepTrial ? "trialing" : "active",
      current_period_end: periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : null,
    })
    .eq("id", membership.id);
}

async function applyInvoiceFailed(invoice: Stripe.Invoice) {
  const subId = (invoice as unknown as { subscription?: string }).subscription;
  if (!subId) return;
  const supabase = createAdminClient() as any;
  await supabase
    .from("memberships")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subId);
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "Stripe not configured (STRIPE_SECRET_KEY missing)." },
      { status: 503 },
    );
  }
  if (!WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: "Webhook secret missing (STRIPE_WEBHOOK_SECRET).",
      },
      { status: 503 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { ok: false, error: "Missing stripe-signature header." },
      { status: 400 },
    );
  }

  // Raw body is required for signature verification.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json(
      { ok: false, error: `Signature verification failed: ${msg}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await applyInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await applyInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.resumed":
      case "customer.subscription.paused":
        await applySubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const piId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : (session.payment_intent?.id ?? null);

        const purchaseType = session.metadata?.matflow_purchase_type;

        console.log(
          `[webhook] checkout.session.completed received: session=${session.id} ` +
          `purchaseType=${purchaseType ?? "none"} email=${session.metadata?.owner_email ?? session.customer_email ?? "unknown"}`,
        );

        if (purchaseType === "platform_subscription") {
          // New gym owner signed up — auto-provision their workspace.
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : (session.subscription?.id ?? null);
          const customerId =
            typeof session.customer === "string"
              ? session.customer
              : (session.customer?.id ?? null);

          const ownerEmail = session.metadata?.owner_email ?? session.customer_email ?? "";

          if (!ownerEmail) {
            console.error(
              `[webhook] Platform subscription session=${session.id} has no owner email ` +
              `(metadata.owner_email and customer_email both empty) — cannot provision. Not retrying.`,
            );
            break;
          }

          console.log(
            `[webhook] Platform subscription detected — calling provisionPlatformGym for ` +
            `"${session.metadata?.gym_name ?? "New Gym"}" <${ownerEmail}> (session=${session.id})`,
          );

          const result = await provisionPlatformGym({
            gymName:              session.metadata?.gym_name    ?? "New Gym",
            ownerName:            session.metadata?.owner_name  ?? "",
            ownerEmail,
            stripeSessionId:      session.id,
            stripePlan:           session.metadata?.matflow_plan     ?? "",
            stripeInterval:       session.metadata?.matflow_interval ?? "",
            stripeCustomerId:     customerId,
            stripeSubscriptionId: subId,
          });

          if (!result.ok) {
            console.error(
              `[webhook] provisionPlatformGym FAILED for session=${session.id}: ${result.error} ` +
              `— returning 500 so Stripe retries (provisioning is idempotent).`,
            );
            return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
          }

          console.log(
            `[webhook] provisionPlatformGym SUCCESS: gymId=${result.gymId} ` +
            `alreadyProvisioned=${result.alreadyProvisioned} (session=${session.id})`,
          );
        } else if (purchaseType === "instructional") {
          await fulfillInstructionalCheckout(session.id, piId);
        } else {
          await fulfillCheckoutSession(session.id, piId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const supabase = createAdminClient() as any;
        await supabase
          .from("memberships")
          .update({ status: "canceled", cancel_at_period_end: false })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      default:
        // Ignore events we don't care about; ack so Stripe doesn't retry.
        break;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Handler crashed.";
    console.error(`Stripe webhook error on ${event.type}:`, err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, type: event.type });
}

export function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "stripe",
    method: "POST",
    description:
      "Stripe webhook. Configure at https://dashboard.stripe.com/webhooks pointing to /api/webhook/stripe with events: invoice.paid, invoice.payment_failed, customer.subscription.{created,updated,deleted,paused,resumed}, checkout.session.completed. ALSO register the same URL as a Connect webhook endpoint (dashboard → Connect → webhook endpoints, 'events from connected accounts') so student subscription events on gyms' connected accounts stay in sync.",
  });
}
