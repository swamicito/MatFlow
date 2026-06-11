"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CreditCard,
  DollarSign,
  Settings,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  INTERVAL_SHORT,
  MEMBERSHIP_STATUS_BADGE,
  MEMBERSHIP_STATUS_LABEL,
  formatMoney,
} from "@/lib/billing";
import {
  cancelSubscription,
  retryPayment,
} from "@/app/(dashboard)/billing/actions";
import { cn } from "@/lib/utils";
import type { Database, MembershipInterval, MembershipStatus } from "@/lib/supabase/types";

type Membership = Database["public"]["Tables"]["memberships"]["Row"];

export type EnrichedMembership = Omit<Membership, 'stripe_customer_id' | 'stripe_subscription_id' | 'stripe_price_id'> & {
  student_name: string;
  plan_name: string;
  plan_interval: MembershipInterval;
  plan_price_cents: number;
  effective_price_cents: number;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
};

export function BillingOverview({
  mrrCents,
  activeCount,
  pastDueCount,
  trialingCount,
  plansCount,
  active,
  pastDue,
  stripeConfigured,
}: {
  mrrCents: number;
  activeCount: number;
  pastDueCount: number;
  trialingCount: number;
  plansCount: number;
  active: EnrichedMembership[];
  pastDue: EnrichedMembership[];
  stripeConfigured: boolean;
}) {
  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Billing
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Subscriptions, invoices, and recurring revenue.
          </p>
        </div>
        <Link
          href="/billing/plans"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-[#222] hover:bg-[#111] text-sm transition-colors"
        >
          <Settings className="h-4 w-4" />
          Manage Plans ({plansCount})
        </Link>
      </div>

      {!stripeConfigured && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Stripe not configured.</p>
            <p className="text-amber-300/80">
              Add <code className="font-mono">STRIPE_SECRET_KEY</code> (and{" "}
              <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> for live
              events) to <code className="font-mono">.env.local</code>. Plan CRUD
              works without it; subscriptions and payments will fail with a
              clear error until set.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="MRR" value={formatMoney(Math.round(mrrCents))} icon={DollarSign} />
        <StatCard label="Active Subscriptions" value={String(activeCount)} icon={Users} />
        <StatCard label="Trialing" value={String(trialingCount)} icon={CreditCard} />
        <StatCard
          label="Past Due"
          value={String(pastDueCount)}
          icon={AlertCircle}
          highlight={pastDueCount > 0}
        />
      </div>

      <SubscriptionsTable
        title="Active subscriptions"
        rows={active}
        empty="No active subscriptions yet."
        showRetry={false}
      />

      <SubscriptionsTable
        title="Past due / failed payments"
        subtitle={`${pastDue.length} requires attention`}
        rows={pastDue}
        empty="Nothing past due. Nice."
        showRetry
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        "bg-[#0a0a0a] border-[#1f1f1f] shadow-none",
        highlight && "border-red-500/40",
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[#aaaaaa]">
              {label}
            </p>
            <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">
              {value}
            </p>
          </div>
          <div
            className={cn(
              "h-10 w-10 grid place-items-center rounded-md border bg-black",
              highlight ? "border-red-500/40 text-red-300" : "border-[#222] text-white",
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionsTable({
  title,
  subtitle,
  rows,
  empty,
  showRetry,
}: {
  title: string;
  subtitle?: string;
  rows: EnrichedMembership[];
  empty: string;
  showRetry: boolean;
}) {
  return (
    <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
      <CardContent className="p-0">
        <div className="px-6 pt-5 pb-3 flex items-baseline justify-between">
          <h2 className="text-base font-medium text-white">{title}</h2>
          {subtitle && (
            <span className="text-xs uppercase tracking-widest text-[#666]">
              {subtitle}
            </span>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-[#555] border-t border-[#1a1a1a] italic">
            {empty}
          </div>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#1f1f1f] hover:bg-transparent">
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Student
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Plan
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Price
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Status
                </TableHead>
                <TableHead className="text-[#888] uppercase text-xs tracking-wider">
                  Next renewal
                </TableHead>
                <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <SubscriptionRow key={row.id} row={row} showRetry={showRetry} />
              ))}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionRow({
  row,
  showRetry,
}: {
  row: EnrichedMembership;
  showRetry: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onRetry() {
    if (pending) return;
    startTransition(async () => {
      const result = await retryPayment(row.id);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Payment retried");
      router.refresh();
    });
  }

  function onCancel() {
    if (!confirm(`Cancel ${row.student_name}'s subscription at period end?`)) {
      return;
    }
    startTransition(async () => {
      const result = await cancelSubscription(row.id, false);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Subscription will cancel at period end");
      router.refresh();
    });
  }

  const isCustom =
    row.custom_price_cents !== null &&
    row.custom_price_cents !== row.plan_price_cents;

  return (
    <TableRow className="border-[#1f1f1f] hover:bg-[#0a0a0a]">
      <TableCell className="font-medium text-white">
        {row.student_name}
      </TableCell>
      <TableCell className="text-[#ccc]">{row.plan_name}</TableCell>
      <TableCell className="text-white tabular-nums">
        {formatMoney(row.effective_price_cents)}
        <span className="text-[#666] ml-1">
          {INTERVAL_SHORT[row.plan_interval]}
        </span>
        {isCustom && (
          <span className="ml-2 inline-flex items-center rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-300 px-2 py-0.5 text-[10px] uppercase tracking-wider">
            Custom
          </span>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge status={row.status} />
        {row.cancel_at_period_end && (
          <span className="ml-2 text-xs text-amber-300">cancels at period end</span>
        )}
      </TableCell>
      <TableCell className="text-[#aaa]">
        {row.current_period_end
          ? new Date(row.current_period_end).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-2">
          {showRetry && (
            <button
              onClick={onRetry}
              disabled={pending}
              className="text-xs px-2 py-1 rounded-md border border-[#222] text-[#aaa] hover:bg-[#111] hover:text-white transition-colors disabled:opacity-40"
            >
              Retry
            </button>
          )}
          {row.status !== "canceled" && (
            <button
              onClick={onCancel}
              disabled={pending}
              className="text-xs px-2 py-1 rounded-md border border-[#222] text-[#aaa] hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: MembershipStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        MEMBERSHIP_STATUS_BADGE[status],
      )}
    >
      {MEMBERSHIP_STATUS_LABEL[status]}
    </span>
  );
}
