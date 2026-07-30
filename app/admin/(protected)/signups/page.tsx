import Link from "next/link";
import { Inbox, CheckCircle2, Clock, XCircle, ExternalLink, Plus } from "lucide-react";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { ProvisionButton } from "./provision-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pending Signups · Platform Admin" };

type PendingSignup = {
  sessionId: string;
  gymName: string;
  ownerName: string;
  ownerEmail: string;
  plan: string;
  interval: string;
  status: Stripe.Checkout.Session["status"];
  createdAt: number;
};

async function listPendingSignups(): Promise<PendingSignup[]> {
  const stripe = getStripe();
  if (!stripe) return [];

  try {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
    });

    return sessions.data
      .filter(
        (s) => s.metadata?.matflow_purchase_type === "platform_subscription",
      )
      .map((s) => ({
        sessionId: s.id,
        gymName:    s.metadata?.gym_name    ?? "(unknown gym)",
        ownerName:  s.metadata?.owner_name  ?? "(unknown)",
        ownerEmail: s.metadata?.owner_email ?? s.customer_email ?? "(no email)",
        plan:       s.metadata?.matflow_plan     ?? "—",
        interval:   s.metadata?.matflow_interval ?? "—",
        status:     s.status,
        createdAt:  s.created,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function StatusBadge({ status }: { status: Stripe.Checkout.Session["status"] }) {
  if (status === "complete") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Paid
      </span>
    );
  }
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400">
        <Clock className="h-3 w-3" />
        In progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B7280]">
      <XCircle className="h-3 w-3" />
      Expired
    </span>
  );
}

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  growth: "Growth",
};

export default async function AdminSignupsPage() {
  const signups = await listPendingSignups();
  const pending = signups.filter((s) => s.status === "complete");
  const stripe  = getStripe();

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Pending Signups
          </h1>
          <p className="text-sm text-[#9CA3AF] mt-1">
            {pending.length} paid signup{pending.length !== 1 ? "s" : ""} awaiting
            manual provisioning ·{" "}
            {signups.length} total checkout{signups.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/admin/gyms/new"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors shrink-0"
        >
          <Plus className="h-4 w-4" />
          Provision Gym
        </Link>
      </div>

      {!stripe && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-5 py-4">
          <p className="text-sm text-amber-400">
            Stripe is not configured — set{" "}
            <code className="font-mono text-amber-300">STRIPE_SECRET_KEY</code> to
            see signups here.
          </p>
        </div>
      )}

      {/* Signups list */}
      {signups.length === 0 ? (
        <div className="border border-[#1a1a1a] rounded-2xl py-20 flex flex-col items-center gap-4 text-center">
          <div className="h-12 w-12 rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] grid place-items-center">
            <Inbox className="h-6 w-6 text-[#6B7280]" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#888]">No signups yet</p>
            <p className="text-xs text-[#9CA3AF] mt-1">
              Completed checkouts from the pricing page will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="border border-[#1a1a1a] rounded-2xl overflow-hidden divide-y divide-[#111]">
          {signups.map((signup) => (
            <div
              key={signup.sessionId}
              className="flex items-center gap-4 px-5 py-4 hover:bg-[#050505] transition-colors"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white truncate">
                    {signup.gymName}
                  </p>
                  <StatusBadge status={signup.status} />
                </div>
                <p className="text-xs text-[#9CA3AF] truncate">
                  {signup.ownerName} · {signup.ownerEmail}
                </p>
              </div>

              <div className="hidden md:flex items-center gap-6 shrink-0 text-[11px]">
                <span className="text-[#9CA3AF]">
                  {PLAN_LABEL[signup.plan] ?? signup.plan} · {signup.interval}
                </span>
                <span className="text-[#6B7280]">
                  {new Date(signup.createdAt * 1000).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {signup.status === "complete" && (
                  <ProvisionButton sessionId={signup.sessionId} />
                )}
                <a
                  href={`https://dashboard.stripe.com/checkout/sessions/${signup.sessionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#1f1f1f] text-[#6B7280] text-xs hover:text-white hover:border-[#333] transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Stripe
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-[#555] text-center">
        Shows the 100 most recent checkout sessions. Refresh to update.
      </p>
    </div>
  );
}
