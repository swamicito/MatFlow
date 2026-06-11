"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  ShoppingBag,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createProduct,
  deleteProduct,
  updateProduct,
  type ProductInput,
  type SalesStats,
} from "@/app/(dashboard)/settings/sell/actions";
import {
  discountPct,
  formatMoney,
  isSpecialActive,
  PACK_PRESETS,
  PRODUCT_TYPE_LABEL,
  PRODUCT_TYPES,
  validityLabel,
  type ProductType,
} from "@/lib/shop";
import type { Database } from "@/lib/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

const DEFAULT_INPUT: ProductInput = {
  name: "",
  description: null,
  product_type: "drop_in",
  price_cents: 0,
  original_price_cents: null,
  class_credits: 1,
  validity_days: null,
  max_quantity: null,
  visible: true,
  special_start_date: null,
  special_end_date: null,
  sort_order: 0,
};

export function SellAdmin({
  initialProducts,
  stats,
}: {
  initialProducts: Product[];
  stats: SalesStats | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [showNew, setShowNew] = useState(false);

  function refresh() {
    router.refresh();
  }

  function toggleVisible(p: Product) {
    startTransition(async () => {
      const r = await updateProduct(p.id, { visible: !p.visible });
      if (!r.ok) toast.error(r.error);
      else refresh();
    });
  }

  function reorder(p: Product, dir: "up" | "down") {
    startTransition(async () => {
      const delta = dir === "up" ? -1 : 1;
      const r = await updateProduct(p.id, {
        sort_order: (p.sort_order ?? 0) + delta,
      });
      if (!r.ok) toast.error(r.error);
      else refresh();
    });
  }

  function remove(p: Product) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteProduct(p.id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Product deleted");
        refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Sales stats */}
      {stats && <StatsBar stats={stats} />}

      <div className="flex items-center justify-between">
        <p className="text-xs text-[#666]">
          {initialProducts.length} products ·{" "}
          {initialProducts.filter((p) => p.visible).length} visible
        </p>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus className="h-4 w-4 mr-1" />
          New product
        </Button>
      </div>

      {initialProducts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#1f1f1f] p-12 text-center">
          <ShoppingBag className="h-8 w-8 text-[#444] mx-auto mb-2" />
          <p className="text-sm text-[#888]">
            No products yet. Create a drop-in, pack, or special to start
            selling.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initialProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              disabled={pending}
              onEdit={() => setEditTarget(p)}
              onToggleVisible={() => toggleVisible(p)}
              onReorder={reorder}
              onDelete={() => remove(p)}
            />
          ))}
        </div>
      )}

      <ProductDialog
        open={showNew || !!editTarget}
        onOpenChange={(v) => {
          if (!v) {
            setShowNew(false);
            setEditTarget(null);
          }
        }}
        initial={editTarget ?? undefined}
        onSaved={refresh}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: SalesStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        {
          label: "Total Revenue",
          value: formatMoney(stats.totalRevenueCents),
          sub: `${stats.totalPurchases} purchases`,
        },
        {
          label: "This Month",
          value: formatMoney(stats.thisMonthRevenueCents),
          sub: `${stats.thisMonthPurchases} purchases`,
        },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4"
        >
          <div className="flex items-center gap-2 text-[#888] text-[11px] uppercase tracking-widest mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            {s.label}
          </div>
          <div className="text-xl font-semibold tabular-nums text-white">
            {s.value}
          </div>
          <div className="text-[10px] text-[#666]">{s.sub}</div>
        </div>
      ))}

      {stats.recentPurchases.length > 0 && (
        <div className="col-span-2 rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4 space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-[#888]">
            Recent Sales
          </p>
          <div className="space-y-1">
            {stats.recentPurchases.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[#ccc] truncate max-w-[200px]">
                  {r.student_name}{" "}
                  <span className="text-[#666]">— {r.product_name ?? "unknown"}</span>
                </span>
                <span className="tabular-nums text-white ml-2">
                  {formatMoney(r.amount_cents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ProductCard({
  product: p,
  disabled,
  onEdit,
  onToggleVisible,
  onReorder,
  onDelete,
}: {
  product: Product;
  disabled: boolean;
  onEdit: () => void;
  onToggleVisible: () => void;
  onReorder: (p: Product, dir: "up" | "down") => void;
  onDelete: () => void;
}) {
  const isSpecial = p.product_type === "special";
  const active = isSpecial
    ? isSpecialActive(p.special_start_date, p.special_end_date)
    : true;
  const disc = discountPct(p.price_cents, p.original_price_cents);

  return (
    <div
      className={cn(
        "rounded-lg border bg-[#0a0a0a] p-4 space-y-3",
        p.visible ? "border-[#1f1f1f]" : "border-[#111] opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-white font-medium">{p.name}</p>
            <span className="text-[10px] uppercase tracking-widest border border-[#222] text-[#888] rounded-full px-2 py-0.5">
              {PRODUCT_TYPE_LABEL[p.product_type as ProductType]}
            </span>
            {isSpecial && active && (
              <span className="text-[10px] uppercase tracking-widest border border-amber-500/40 bg-amber-500/10 text-amber-300 rounded-full px-2 py-0.5">
                Live
              </span>
            )}
          </div>
          {p.description && (
            <p className="text-xs text-[#888] mt-0.5 truncate">{p.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onReorder(p, "up")}
            className="h-7 w-7 grid place-items-center rounded border border-[#222] text-[#666] hover:text-white hover:border-[#333]"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onReorder(p, "down")}
            className="h-7 w-7 grid place-items-center rounded border border-[#222] text-[#666] hover:text-white hover:border-[#333]"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-sm">
        <div>
          <span className="text-xl font-semibold tabular-nums text-white">
            {formatMoney(p.price_cents)}
          </span>
          {p.original_price_cents && (
            <span className="ml-2 line-through text-[#666] tabular-nums">
              {formatMoney(p.original_price_cents)}
            </span>
          )}
          {disc && (
            <span className="ml-2 text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-1.5 py-0.5">
              -{disc}%
            </span>
          )}
        </div>
        <span className="text-[#666] text-xs">
          {p.class_credits > 0
            ? `${p.class_credits} credit${p.class_credits > 1 ? "s" : ""}`
            : "no credits"}
        </span>
        <span className="text-[#666] text-xs">
          {validityLabel(p.validity_days)}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          disabled={disabled}
          onClick={onToggleVisible}
          className="inline-flex items-center gap-1.5 text-xs text-[#aaa] hover:text-white"
        >
          {p.visible ? (
            <Eye className="h-3.5 w-3.5" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" />
          )}
          {p.visible ? "Visible" : "Hidden"}
        </button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onEdit}
          className="border-[#333] bg-transparent text-white hover:bg-[#111] h-7 px-2"
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={onDelete}
          className="border-[#333] bg-transparent text-white hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 h-7 px-2"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ProductDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Product;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ProductInput>(
    initial
      ? {
          name: initial.name,
          description: initial.description,
          product_type: initial.product_type as ProductType,
          price_cents: initial.price_cents,
          original_price_cents: initial.original_price_cents,
          class_credits: initial.class_credits,
          validity_days: initial.validity_days,
          max_quantity: initial.max_quantity,
          visible: initial.visible,
          special_start_date: initial.special_start_date,
          special_end_date: initial.special_end_date,
          sort_order: initial.sort_order,
        }
      : { ...DEFAULT_INPUT },
  );

  function set<K extends keyof ProductInput>(k: K, v: ProductInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function applyPackPreset(preset: (typeof PACK_PRESETS)[number]) {
    set("class_credits", preset.class_credits);
    set("validity_days", preset.validity_days);
    if (!form.name) set("name", preset.label);
  }

  function submit() {
    startTransition(async () => {
      const res = isEdit
        ? await updateProduct(initial!.id, form)
        : await createProduct(form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Product updated" : "Product created");
      onOpenChange(false);
      onSaved();
    });
  }

  const dollars = (cents: number | null | undefined) =>
    cents != null ? String(cents / 100) : "";

  const parseCents = (v: string) => {
    const n = parseFloat(v || "0");
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "New product"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick pack presets */}
          {(form.product_type === "pack" || (!isEdit && form.product_type === "drop_in")) && (
            <div>
              <Label className="text-xs text-[#888] uppercase tracking-wider">
                Pack presets
              </Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {PACK_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPackPreset(p)}
                    className="text-sm rounded-md border border-[#222] bg-black hover:bg-[#111] hover:border-[#333] px-3 py-1.5"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2 col-span-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
                placeholder="e.g. 10-Class Pack"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.product_type}
                onValueChange={(v) => v && set("product_type", v as ProductType)}
              >
                <SelectTrigger className="bg-black border-[#222] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
                  {PRODUCT_TYPES.map((t) => (
                    <SelectItem
                      key={t}
                      value={t}
                      className="focus:bg-[#111] focus:text-white"
                    >
                      {PRODUCT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={dollars(form.price_cents)}
                onChange={(e) => set("price_cents", parseCents(e.target.value))}
                className={inputCls}
                placeholder="25.00"
              />
            </div>
          </div>

          {form.product_type === "special" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Original Price ($) <span className="text-[#666]">(for strike-through)</span></Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={dollars(form.original_price_cents)}
                  onChange={(e) =>
                    set(
                      "original_price_cents",
                      e.target.value ? parseCents(e.target.value) : null,
                    )
                  }
                  className={inputCls}
                  placeholder="40.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Max quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.max_quantity ?? ""}
                  onChange={(e) =>
                    set(
                      "max_quantity",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className={inputCls}
                  placeholder="Unlimited"
                />
              </div>
              <div className="space-y-2">
                <Label>Special starts</Label>
                <Input
                  type="date"
                  value={form.special_start_date ?? ""}
                  onChange={(e) =>
                    set("special_start_date", e.target.value || null)
                  }
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <Label>Special ends</Label>
                <Input
                  type="date"
                  value={form.special_end_date ?? ""}
                  onChange={(e) =>
                    set("special_end_date", e.target.value || null)
                  }
                  className={inputCls}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {form.product_type !== "gift_card" &&
              form.product_type !== "private" && (
                <div className="space-y-2">
                  <Label>Class credits</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.class_credits}
                    onChange={(e) =>
                      set("class_credits", Number(e.target.value))
                    }
                    className={inputCls}
                  />
                </div>
              )}
            <div className="space-y-2">
              <Label>Validity (days)</Label>
              <Input
                type="number"
                min={1}
                value={form.validity_days ?? ""}
                onChange={(e) =>
                  set("validity_days", e.target.value ? Number(e.target.value) : null)
                }
                className={inputCls}
                placeholder="No expiry"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              className={inputCls}
              placeholder="Optional — shown to students"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.visible}
              onChange={(e) => set("visible", e.target.checked)}
              className="h-4 w-4 rounded border-[#333] bg-black accent-white"
            />
            <span className="text-sm text-[#ccc]">
              Visible to students in the shop
            </span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#333] bg-transparent text-white hover:bg-[#111]"
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !form.name}
              className="bg-white text-black hover:bg-white/90"
            >
              {pending ? "Saving…" : isEdit ? "Save changes" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
