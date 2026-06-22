"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag,
  CreditCard,
  Gift,
  RefreshCw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/portal-utils";
import { createStudentPortalSession } from "@/app/portal/actions";
import type { PortalMembership, PortalCredits } from "@/app/portal/actions";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "border-emerald-500/30 text-emerald-400" },
  trialing:  { label: "Trial",     cls: "border-blue-500/30 text-blue-400" },
  paused:    { label: "Paused",    cls: "border-amber-500/30 text-amber-400" },
  cancelled: { label: "Cancelled", cls: "border-[#333] text-[#555]" },
  past_due:  { label: "Past Due",  cls: "border-red-500/30 text-red-400" },
};

export function MembershipClient({
  studentId,
  memberships,
  credits,
}: {
  studentId: string;
  memberships: PortalMembership[];
  credits: PortalCredits;
}) {
  const activeMembership = memberships.find(
    (m) => m.status === "active" || m.status === "trialing",
  );
  const historicalMemberships = memberships.filter(
    (m) => m.status !== "active" && m.status !== "trialing",
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Membership</h1>

      {/* ── Credits ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn("rounded-xl border bg-[#0a0a0a] p-4 space-y-1", credits.class_credits > 0 ? "border-white/15" : "border-[#1a1a1a]")}>
          <div className="flex items-center gap-1.5 text-xs text-[#555]">
            <CreditCard className="h-3.5 w-3.5" /> Class Credits
          </div>
          <p className="text-4xl font-bold text-white">{credits.class_credits}</p>
          <p className="text-xs text-[#444]">remaining</p>
        </div>
        <div className={cn("rounded-xl border bg-[#0a0a0a] p-4 space-y-1", credits.gift_card_balance_cents > 0 ? "border-white/15" : "border-[#1a1a1a]")}>
          <div className="flex items-center gap-1.5 text-xs text-[#555]">
            <Gift className="h-3.5 w-3.5" /> Gift Card
          </div>
          <p className="text-4xl font-bold text-white">
            {credits.gift_card_balance_cents > 0
              ? formatCents(credits.gift_card_balance_cents)
              : "$0"}
          </p>
          <p className="text-xs text-[#444]">balance</p>
        </div>
      </div>

      {/* ── Active plan ── */}
      {activeMembership ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-white">Current Plan</h2>
          <ActiveMembershipCard membership={activeMembership} studentId={studentId} />
        </section>
      ) : (
        <section className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] py-12 flex flex-col items-center gap-4">
          <div className="h-14 w-14 grid place-items-center rounded-2xl border border-[#222] bg-black">
            <ShoppingBag className="h-6 w-6 text-[#444]" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-white">No active membership</p>
            <p className="text-xs text-[#555]">
              Talk to your gym about getting set up on a plan.
            </p>
          </div>
        </section>
      )}

      {/* ── Past memberships ── */}
      {historicalMemberships.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-[#555]">Past Plans</h2>
          <div className="divide-y divide-[#111] rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
            {historicalMemberships.map((m) => {
              const meta = STATUS_META[m.status] ?? { label: m.status, cls: "border-[#333] text-[#555]" };
              return (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{m.plan_name}</p>
                    <p className="text-xs text-[#555]">
                      Started {new Date(m.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <span className={cn("text-[10px] border rounded-full px-2 py-0.5 uppercase tracking-widest", meta.cls)}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ActiveMembershipCard({
  membership,
  studentId,
}: {
  membership: PortalMembership;
  studentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const meta = STATUS_META[membership.status] ?? { label: membership.status, cls: "border-[#333] text-[#555]" };

  function handleManage() {
    startTransition(async () => {
      const origin = window.location.origin;
      const result = await createStudentPortalSession(
        studentId,
        `${origin}/portal/membership`,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.url);
    });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-5 space-y-4">
      {/* Plan header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-base font-semibold text-white">{membership.plan_name}</p>
          <p className="text-xs text-[#555]">
            Started{" "}
            {new Date(membership.start_date).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <span className={cn("text-[10px] border rounded-full px-2.5 py-1 uppercase tracking-widest shrink-0", meta.cls)}>
          {meta.label}
        </span>
      </div>

      {/* Renewal date */}
      {membership.current_period_end && (
        <div className="rounded-lg border border-[#1a1a1a] bg-black px-4 py-3 flex items-center gap-2">
          <RefreshCw className="h-3.5 w-3.5 text-[#555] shrink-0" />
          <div>
            <p className="text-xs text-[#555]">Next billing date</p>
            <p className="text-sm font-medium text-white">
              {new Date(membership.current_period_end).toLocaleDateString("en-US", {
                weekday: "short",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}

      {/* Manage button */}
      <button
        onClick={handleManage}
        disabled={pending}
        className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <CreditCard className="h-4 w-4" />
            Manage billing
          </>
        )}
      </button>

      <div className="flex items-start gap-1.5 text-[11px] text-[#444]">
        <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
        <span>You&apos;ll be redirected to a secure Stripe page to update your payment method, view invoices, or cancel your subscription.</span>
      </div>
    </div>
  );
}
