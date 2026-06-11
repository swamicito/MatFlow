"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  CreditCard,
  Gift,
  History,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCheckoutSession,
  getStudentShopData,
  recordManualPurchase,
  type StudentShopData,
} from "@/app/(dashboard)/settings/sell/actions";
import {
  discountPct,
  formatMoney,
  isSpecialActive,
  PRODUCT_TYPE_LABEL,
  PURCHASE_STATUS_BADGE,
  PURCHASE_STATUS_LABEL,
  validityLabel,
  type ProductType,
  type PurchaseStatus,
} from "@/lib/shop";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

export function ShopSection({
  studentId,
  enabled,
  stripeConfigured,
}: {
  studentId: string;
  enabled: boolean;
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<StudentShopData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyTarget, setBuyTarget] = useState<Product | null>(null);

  async function load() {
    setLoading(true);
    const res = await getStudentShopData(studentId);
    setLoading(false);
    if (!res.ok) setError(res.error);
    else setData(res.data);
  }

  useEffect(() => {
    if (!enabled || !studentId) return;
    let cancelled = false;
    setError(null);
    setLoading(true);
    getStudentShopData(studentId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) setError(res.error);
      else setData(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, enabled]);

  if (!enabled) return null;

  const credits = data?.credits;
  const hasCredits =
    (credits?.class_credits ?? 0) > 0 ||
    (credits?.gift_card_balance_cents ?? 0) > 0;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[#888]">Shop</h3>
        {hasCredits && (
          <div className="flex items-center gap-3">
            {(credits?.class_credits ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-2 py-0.5">
                <Award className="h-3 w-3" />
                {credits!.class_credits} class credit
                {credits!.class_credits !== 1 ? "s" : ""}
              </span>
            )}
            {(credits?.gift_card_balance_cents ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-300 border border-amber-500/40 bg-amber-500/10 rounded-full px-2 py-0.5">
                <Gift className="h-3 w-3" />
                {formatMoney(credits!.gift_card_balance_cents)}
              </span>
            )}
          </div>
        )}
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
              <Skeleton className="h-4 w-3/4 bg-[#1a1a1a]" />
              <Skeleton className="h-3 w-1/2 bg-[#1a1a1a]" />
              <div className="flex justify-between items-center pt-1">
                <Skeleton className="h-6 w-16 bg-[#1a1a1a]" />
                <Skeleton className="h-8 w-16 bg-[#1a1a1a] rounded-md" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error.includes("products") || error.includes("relation") ? (
            <>
              Shop tables are missing. Apply{" "}
              <code className="text-white">supabase/migrations/0008_shop.sql</code>{" "}
              and reload.
            </>
          ) : (
            error
          )}
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Products grid */}
          {data.products.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#1f1f1f] p-6 text-center text-sm text-[#666]">
              No products available. The gym owner can add some at{" "}
              <span className="text-white">Settings → Products & Sales</span>.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  stripeConfigured={stripeConfigured}
                  onBuy={() => setBuyTarget(p)}
                />
              ))}
            </div>
          )}

          {/* Purchase history */}
          {data.purchases.length > 0 && (
            <PurchaseHistory purchases={data.purchases} />
          )}
        </div>
      ) : null}

      {/* Buy dialog */}
      {buyTarget && (
        <BuyDialog
          product={buyTarget}
          studentId={studentId}
          stripeConfigured={stripeConfigured}
          onClose={() => setBuyTarget(null)}
          onPurchased={() => {
            setBuyTarget(null);
            load();
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Credit balance pill (exported for use in dialog header)
// ─────────────────────────────────────────────────────────────────────────────

export function CreditPill({
  classCredits,
  giftCardCents,
}: {
  classCredits: number;
  giftCardCents: number;
}) {
  if (classCredits === 0 && giftCardCents === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {classCredits > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-1.5 py-0.5">
          <Award className="h-3 w-3" />
          {classCredits}cr
        </span>
      )}
      {giftCardCents > 0 && (
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-300 border border-amber-500/40 bg-amber-500/10 rounded-full px-1.5 py-0.5">
          <Gift className="h-3 w-3" />
          {formatMoney(giftCardCents)}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product card
// ─────────────────────────────────────────────────────────────────────────────

function ProductCard({
  product: p,
  stripeConfigured,
  onBuy,
}: {
  product: Product;
  stripeConfigured: boolean;
  onBuy: () => void;
}) {
  const isSpecial = p.product_type === "special";
  const active = !isSpecial || isSpecialActive(p.special_start_date, p.special_end_date);
  const disc = discountPct(p.price_cents, p.original_price_cents);

  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-medium">{p.name}</p>
            {isSpecial && active && (
              <span className="text-[9px] uppercase tracking-widest border border-amber-500/40 bg-amber-500/10 text-amber-300 rounded-full px-1.5 py-0.5">
                Limited time
              </span>
            )}
          </div>
          {p.description && (
            <p className="text-xs text-[#888] mt-0.5">{p.description}</p>
          )}
          <p className="text-[10px] text-[#666] mt-1">
            {PRODUCT_TYPE_LABEL[p.product_type as ProductType]}
            {p.class_credits > 0 &&
              p.product_type !== "gift_card" &&
              p.product_type !== "private" &&
              ` · ${p.class_credits} class${p.class_credits > 1 ? "es" : ""}`}
            {p.validity_days && ` · ${validityLabel(p.validity_days)}`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-auto">
        <div>
          <span className="text-lg font-semibold tabular-nums text-white">
            {formatMoney(p.price_cents)}
          </span>
          {p.original_price_cents && (
            <span className="ml-2 text-[#666] line-through text-sm tabular-nums">
              {formatMoney(p.original_price_cents)}
            </span>
          )}
          {disc && (
            <span className="ml-2 text-[10px] uppercase text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-1.5 py-0.5">
              -{disc}%
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={onBuy}
          className="bg-white text-black hover:bg-white/90"
        >
          <ShoppingBag className="h-3.5 w-3.5 mr-1" />
          Buy
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Buy dialog
// ─────────────────────────────────────────────────────────────────────────────

function BuyDialog({
  product,
  studentId,
  stripeConfigured,
  onClose,
  onPurchased,
}: {
  product: Product;
  studentId: string;
  stripeConfigured: boolean;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [mode, setMode] = useState<"stripe" | "manual">(
    stripeConfigured ? "stripe" : "manual",
  );

  function onStripeCheckout() {
    startTransition(async () => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const res = await createCheckoutSession(
        studentId,
        product.id,
        1,
        `${origin}/students`,
        `${origin}/students`,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.data.url;
    });
  }

  function onManual() {
    startTransition(async () => {
      const res = await recordManualPurchase({
        studentId,
        productId: product.id,
        quantity: 1,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Sale recorded — credits applied");
      onPurchased();
    });
  }

  const disc = discountPct(product.price_cents, product.original_price_cents);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pricing summary */}
          <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#aaa]">Price</span>
              <div className="flex items-center gap-2">
                {product.original_price_cents && (
                  <span className="text-sm line-through text-[#666] tabular-nums">
                    {formatMoney(product.original_price_cents)}
                  </span>
                )}
                <span className="text-white font-semibold tabular-nums">
                  {formatMoney(product.price_cents)}
                </span>
              </div>
            </div>
            {disc && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#666]">Discount</span>
                <span className="text-emerald-300">-{disc}%</span>
              </div>
            )}
            {product.class_credits > 0 &&
              product.product_type !== "gift_card" &&
              product.product_type !== "private" && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#666]">Class credits</span>
                  <span className="text-white">{product.class_credits}</span>
                </div>
              )}
            {product.validity_days && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#666]">Expires in</span>
                <span className="text-white">{validityLabel(product.validity_days)}</span>
              </div>
            )}
          </div>

          {/* Mode selector */}
          {stripeConfigured ? (
            <div className="flex rounded-md overflow-hidden border border-[#222]">
              {(["stripe", "manual"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={cn(
                    "flex-1 py-2 text-sm transition-colors",
                    mode === m
                      ? "bg-white text-black"
                      : "bg-black text-[#aaa] hover:text-white",
                  )}
                >
                  {m === "stripe" ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" />
                      Manual
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-3 text-xs text-[#888]">
              Stripe is not configured. Recording a manual (cash / card) sale.
              Credits will be applied immediately.
            </div>
          )}

          {(mode === "manual" || !stripeConfigured) && (
            <div className="space-y-2">
              <label className="text-xs text-[#888]">Notes (optional)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Cash, card, Venmo…"
                className="w-full rounded-md border border-[#222] bg-black text-white text-sm px-3 py-2 placeholder:text-[#666] focus:outline-none focus:ring-1 focus:ring-white/40"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={pending}
              className="border-[#333] bg-transparent text-white hover:bg-[#111]"
            >
              Cancel
            </Button>
            <Button
              onClick={mode === "stripe" && stripeConfigured ? onStripeCheckout : onManual}
              disabled={pending}
              className="bg-white text-black hover:bg-white/90"
            >
              {pending
                ? "Processing…"
                : mode === "stripe" && stripeConfigured
                  ? "Pay online"
                  : "Record sale"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Purchase history
// ─────────────────────────────────────────────────────────────────────────────

function PurchaseHistory({
  purchases,
}: {
  purchases: { id: string; product_name: string | null; amount_cents: number; status: string; created_at: string; credits_granted: number }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? purchases : purchases.slice(0, 3);

  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#888] uppercase tracking-wider flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Purchase history
        </span>
        <span className="text-[10px] text-[#666]">{purchases.length} total</span>
      </div>
      <div className="space-y-1.5">
        {visible.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="min-w-0">
              <span className="text-[#ccc] truncate">{p.product_name ?? "Unknown product"}</span>
              <span className="text-[#666] text-xs ml-2">
                {new Date(p.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              {p.credits_granted > 0 && (
                <span className="text-[10px] text-emerald-300 ml-2">
                  +{p.credits_granted}cr
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                  PURCHASE_STATUS_BADGE[p.status as PurchaseStatus] ??
                    "border-[#222] text-[#888]",
                )}
              >
                {PURCHASE_STATUS_LABEL[p.status as PurchaseStatus] ?? p.status}
              </span>
              <span className="tabular-nums text-white">
                {formatMoney(p.amount_cents)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {purchases.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-xs text-[#666] hover:text-white"
        >
          {expanded ? "Show less" : `Show all ${purchases.length}`}
        </button>
      )}
    </div>
  );
}
