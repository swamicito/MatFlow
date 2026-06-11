"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Gift,
  ShoppingBag,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Loader2,
  Package,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/portal-utils";
import {
  createProductCheckout,
  createStudentPortalSession,
} from "@/app/portal/actions";
import type {
  PortalCredits,
  PortalPurchase,
  PortalMembership,
  PortalProduct,
} from "@/app/portal/actions";

// ─────────────────────────────────────────────────────────────────────────────
// Status badge config
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_META: Record<
  string,
  { label: string; cls: string; Icon: React.ElementType }
> = {
  paid:     { label: "Paid",     cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", Icon: CheckCircle2 },
  free:     { label: "Free",     cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10", Icon: CheckCircle2 },
  manual:   { label: "Manual",   cls: "text-[#888] border-[#333] bg-[#111]",                     Icon: CheckCircle2 },
  pending:  { label: "Pending",  cls: "text-amber-400 border-amber-500/30 bg-amber-500/10",      Icon: Clock },
  failed:   { label: "Failed",   cls: "text-red-400 border-red-500/30 bg-red-500/10",            Icon: XCircle },
  refunded: { label: "Refunded", cls: "text-[#888] border-[#333] bg-[#111]",                     Icon: XCircle },
};

const TYPE_LABEL: Record<string, string> = {
  drop_in:   "Drop-in",
  class_pack: "Class Pack",
  membership: "Membership",
  merch:      "Merch",
  gift_card:  "Gift Card",
  other:      "Other",
};

// ─────────────────────────────────────────────────────────────────────────────
// Main client component
// ─────────────────────────────────────────────────────────────────────────────

export function ShopClient({
  studentId,
  credits,
  purchases,
  memberships,
  products,
}: {
  studentId: string;
  credits: PortalCredits;
  purchases: PortalPurchase[];
  memberships: PortalMembership[];
  products: PortalProduct[];
}) {
  const activeMembership = memberships.find(
    (m) => m.status === "active" || m.status === "trialing",
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Shop</h1>

      {/* ── Balance row ── */}
      <div className="grid grid-cols-2 gap-3">
        <BalanceCard
          icon={CreditCard}
          label="Class Credits"
          value={String(credits.class_credits)}
          sub="remaining"
          highlight={credits.class_credits > 0}
        />
        <BalanceCard
          icon={Gift}
          label="Gift Card"
          value={
            credits.gift_card_balance_cents > 0
              ? formatCents(credits.gift_card_balance_cents)
              : "$0"
          }
          sub="balance"
          highlight={credits.gift_card_balance_cents > 0}
        />
      </div>

      {/* ── Active membership ── */}
      {activeMembership && (
        <MembershipCard
          membership={activeMembership}
          studentId={studentId}
        />
      )}

      {/* ── Available products ── */}
      {products.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-white">Available to Buy</h2>
          <div className="space-y-2">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                studentId={studentId}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Purchase history ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-white">Purchase History</h2>
        {purchases.length === 0 ? (
          <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] py-12 flex flex-col items-center gap-3">
            <p className="text-3xl">🛍️</p>
            <p className="text-sm text-[#555]">No purchases yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#111] rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
            {purchases.map((p) => {
              const meta = STATUS_META[p.status] ?? STATUS_META.pending;
              const { Icon } = meta;
              return (
                <div key={p.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {p.product_name ?? "Class Pack"}
                    </p>
                    <p className="text-xs text-[#555]">
                      {new Date(p.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {p.credits_granted > 0 && (
                        <span className="ml-1.5 text-white/50">
                          · +{p.credits_granted} credits
                        </span>
                      )}
                      {p.expires_at && new Date(p.expires_at) > new Date() && (
                        <span className="ml-1.5 text-amber-400/70">
                          · Expires{" "}
                          {new Date(p.expires_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-white">
                      {formatCents(p.amount_cents)}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[10px] border rounded-full px-2 py-0.5",
                        meta.cls,
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function BalanceCard({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-[#0a0a0a] p-4 space-y-1",
        highlight ? "border-white/15" : "border-[#1a1a1a]",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-[#555]">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="text-4xl font-bold text-white">{value}</p>
      <p className="text-xs text-[#444]">{sub}</p>
    </div>
  );
}

function MembershipCard({
  membership,
  studentId,
}: {
  membership: PortalMembership;
  studentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleManage() {
    startTransition(async () => {
      const origin = window.location.origin;
      const result = await createStudentPortalSession(
        studentId,
        `${origin}/portal/shop`,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.url);
    });
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 grid place-items-center rounded-lg border border-[#222] bg-black shrink-0">
          <ShoppingBag className="h-4 w-4 text-[#888]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#555] uppercase tracking-widest">
            Active Membership
          </p>
          <p className="text-sm font-semibold text-white truncate">
            {membership.plan_name}
          </p>
          {membership.current_period_end && (
            <p className="text-xs text-[#555] mt-0.5">
              Renews{" "}
              {new Date(membership.current_period_end).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" },
              )}
            </p>
          )}
        </div>
        <span className="text-[10px] uppercase tracking-widest border border-emerald-500/30 text-emerald-400 rounded-full px-2 py-0.5 shrink-0">
          Active
        </span>
      </div>
      <button
        onClick={handleManage}
        disabled={pending}
        className="w-full h-9 flex items-center justify-center gap-2 rounded-lg border border-[#222] bg-black text-xs text-[#aaa] hover:border-[#333] hover:text-white transition-colors disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        Manage subscription
      </button>
    </section>
  );
}

function ProductCard({
  product,
  studentId,
}: {
  product: PortalProduct;
  studentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleBuy() {
    startTransition(async () => {
      const origin = window.location.origin;
      const result = await createProductCheckout(
        studentId,
        product.id,
        `${origin}/portal/shop?success=1`,
        `${origin}/portal/shop`,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(result.url);
    });
  }

  const typeLabel = TYPE_LABEL[product.product_type] ?? product.product_type;

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex items-center gap-4">
      {/* Icon */}
      <div className="h-10 w-10 grid place-items-center rounded-lg border border-[#222] bg-black shrink-0">
        <Package className="h-5 w-5 text-[#555]" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-white truncate">{product.name}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-[#555] border border-[#222] rounded px-1.5 py-0.5">
            {typeLabel}
          </span>
          {product.class_credits > 0 && (
            <span className="text-[10px] text-[#666]">
              {product.class_credits} credit{product.class_credits !== 1 ? "s" : ""}
            </span>
          )}
          {product.validity_days && (
            <span className="text-[10px] text-[#666]">
              · {product.validity_days}d validity
            </span>
          )}
        </div>
        {product.description && (
          <p className="text-xs text-[#555] leading-relaxed line-clamp-2 pt-0.5">
            {product.description}
          </p>
        )}
      </div>

      {/* Price + buy */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <p className="text-base font-bold text-white">
          {product.price_cents === 0 ? "Free" : formatCents(product.price_cents)}
        </p>
        {product.stripe_price_id ? (
          <button
            onClick={handleBuy}
            disabled={pending}
            className="h-8 flex items-center gap-1.5 rounded-lg bg-white text-black text-xs font-semibold px-3 hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                Buy
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        ) : (
          <span className="text-[10px] text-[#444]">Ask your coach</span>
        )}
      </div>
    </div>
  );
}
