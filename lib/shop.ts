/**
 * Shop helpers: product types, pricing display, credit logic.
 */

export type ProductType =
  | "drop_in"
  | "pack"
  | "private"
  | "gift_card"
  | "special";

export const PRODUCT_TYPES: ProductType[] = [
  "drop_in",
  "pack",
  "private",
  "gift_card",
  "special",
];

export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  drop_in: "Drop-in",
  pack: "Class Pack",
  private: "Private Session",
  gift_card: "Gift Card",
  special: "Special Offer",
};

export const PRODUCT_TYPE_DESCRIPTION: Record<ProductType, string> = {
  drop_in: "Single class visit",
  pack: "Bundle of class credits",
  private: "One-on-one coaching session",
  gift_card: "Redeemable gift card balance",
  special: "Limited-time discounted offer",
};

export type PurchaseStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "manual";

export const PURCHASE_STATUS_LABEL: Record<PurchaseStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  refunded: "Refunded",
  manual: "Manual",
};

export const PURCHASE_STATUS_BADGE: Record<PurchaseStatus, string> = {
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  paid: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-300",
  refunded: "border-[#333] bg-black text-[#888]",
  manual: "border-blue-500/40 bg-blue-500/10 text-blue-300",
};

/** Format dollars from cents. */
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Validity string for display. */
export function validityLabel(days: number | null | undefined): string {
  if (!days) return "No expiry";
  if (days === 30) return "30 days";
  if (days === 60) return "60 days";
  if (days === 90) return "90 days";
  if (days === 365) return "1 year";
  return `${days} days`;
}

/** Expiry date from purchase date + validity_days. */
export function expiresAt(
  purchasedAt: Date,
  validityDays: number | null | undefined,
): Date | null {
  if (!validityDays) return null;
  const d = new Date(purchasedAt);
  d.setDate(d.getDate() + validityDays);
  return d;
}

/** True if a special is currently active. */
export function isSpecialActive(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (startDate && today < startDate) return false;
  if (endDate && today > endDate) return false;
  return true;
}

/** Discount percentage for a special. */
export function discountPct(
  priceCents: number,
  originalCents: number | null | undefined,
): number | null {
  if (!originalCents || originalCents <= priceCents) return null;
  return Math.round(((originalCents - priceCents) / originalCents) * 100);
}

/** Pack size presets for quick product creation. */
export const PACK_PRESETS: {
  label: string;
  class_credits: number;
  validity_days: number;
}[] = [
  { label: "5-pack", class_credits: 5, validity_days: 60 },
  { label: "10-pack", class_credits: 10, validity_days: 90 },
  { label: "20-pack", class_credits: 20, validity_days: 180 },
];

/** Returns how many class credits a purchase grants. */
export function creditsForProduct(
  productType: ProductType,
  classCredits: number,
  quantity: number,
): number {
  if (productType === "gift_card" || productType === "private") return 0;
  return classCredits * quantity;
}

/** Returns gift-card dollar amount from a purchase. */
export function giftCardCents(
  productType: ProductType,
  priceCents: number,
  quantity: number,
): number {
  if (productType !== "gift_card") return 0;
  return priceCents * quantity;
}
