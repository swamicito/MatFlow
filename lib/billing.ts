import type {
  MembershipInterval,
  MembershipStatus,
} from "@/lib/supabase/types";

export const INTERVALS: MembershipInterval[] = [
  "month",
  "quarter",
  "year",
  "week",
];

export const INTERVAL_LABEL: Record<MembershipInterval, string> = {
  week: "Weekly",
  month: "Monthly",
  quarter: "Quarterly",
  year: "Yearly",
};

export const INTERVAL_SHORT: Record<MembershipInterval, string> = {
  week: "/wk",
  month: "/mo",
  quarter: "/qtr",
  year: "/yr",
};

export const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Past Due",
  canceled: "Canceled",
  paused: "Paused",
};

export const MEMBERSHIP_STATUS_BADGE: Record<MembershipStatus, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  trialing: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  past_due: "border-red-500/40 bg-red-500/10 text-red-300",
  canceled: "border-[#333] bg-[#111] text-[#888]",
  paused: "border-amber-500/40 bg-amber-500/10 text-amber-300",
};

export function formatMoney(cents: number | null | undefined): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/**
 * Normalize a price to a monthly figure for MRR calculations.
 */
export function toMonthlyCents(
  cents: number,
  interval: MembershipInterval,
): number {
  switch (interval) {
    case "week":
      return (cents * 52) / 12;
    case "month":
      return cents;
    case "quarter":
      return cents / 3;
    case "year":
      return cents / 12;
    default:
      return cents;
  }
}

/**
 * Subset of statuses that count toward MRR.
 */
export function isRevenueStatus(s: MembershipStatus): boolean {
  return s === "active" || s === "trialing";
}
