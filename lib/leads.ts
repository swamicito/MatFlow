import type { LeadStatus } from "@/lib/supabase/types";

export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "trial_scheduled",
  "trial_completed",
  "converted",
  "lost",
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  trial_scheduled: "Trial Scheduled",
  trial_completed: "Showed Up",
  converted: "Converted",
  lost: "Lost",
};

/**
 * Badge styling per status. Subtle colored borders + tinted backgrounds keep
 * the high-contrast B&W feel while making status scannable.
 */
export const LEAD_STATUS_BADGE: Record<LeadStatus, string> = {
  new: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  contacted: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  trial_scheduled: "border-orange-500/40 bg-orange-500/10 text-orange-300",
  trial_completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  converted: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  lost: "border-[#333] bg-[#111] text-[#888]",
};
