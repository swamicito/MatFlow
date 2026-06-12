import type { BeltRank, StudentStatus } from "@/lib/supabase/types";

/**
 * Full belt progression (BJJ) — adult + youth belts in logical order.
 * Used to populate dropdowns and validate belt updates.
 */
export const ADULT_BELTS: BeltRank[] = [
  "white",
  "gray",
  "yellow",
  "orange",
  "green",
  "blue",
  "purple",
  "brown",
  "black",
];

export const BELT_LABEL: Record<BeltRank, string> = {
  white: "White",
  gray: "Gray",
  yellow: "Yellow",
  orange: "Orange",
  green: "Green",
  blue: "Blue",
  purple: "Purple",
  brown: "Brown",
  black: "Black",
};

/**
 * Subtle B&W-friendly belt color tokens (border + tint + text).
 */
export const BELT_BADGE: Record<BeltRank, string> = {
  white: "border-[#333] bg-[#111] text-[#ddd]",
  gray: "border-[#444] bg-[#1a1a1a] text-[#bbb]",
  yellow: "border-yellow-500/40 bg-yellow-500/10 text-yellow-200",
  orange: "border-orange-500/40 bg-orange-500/10 text-orange-200",
  green: "border-green-500/40 bg-green-500/10 text-green-200",
  blue: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  purple: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  brown: "border-amber-700/50 bg-amber-700/10 text-amber-300",
  black: "border-[#444] bg-black text-white",
};

export const STUDENT_STATUSES: StudentStatus[] = [
  "active",
  "trial",
  "paused",
  "cancelled",
];

export const STUDENT_STATUS_LABEL: Record<StudentStatus, string> = {
  active: "Active",
  trial: "Trial",
  paused: "Paused",
  cancelled: "Cancelled",
};

export const STUDENT_STATUS_BADGE: Record<StudentStatus, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  trial: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  paused: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  cancelled: "border-[#333] bg-[#111] text-[#888]",
};

/**
 * Default BJJ skills checklist for the belt-progression tracker.
 * Stored on `belt_progress.skills_completed` as a JSON array of these IDs.
 */
export type BjjSkill = { id: string; label: string };

export const BJJ_SKILLS: BjjSkill[] = [
  { id: "hip_escape", label: "Hip Escape (Shrimping)" },
  { id: "bridging", label: "Bridging (Upa)" },
  { id: "technical_standup", label: "Technical Stand-Up" },
  { id: "forward_roll", label: "Forward Breakfall Roll" },
  { id: "backward_roll", label: "Backward Breakfall Roll" },
  { id: "mount_escape", label: "Mount Escape" },
  { id: "side_control_escape", label: "Side Control Escape" },
  { id: "closed_guard_retention", label: "Closed Guard Retention" },
  { id: "triangle_choke", label: "Triangle Choke from Guard" },
  { id: "armbar_guard", label: "Armbar from Guard" },
  { id: "rear_naked_choke", label: "Rear Naked Choke" },
  { id: "kimura_guard", label: "Kimura from Guard" },
];

export function computeProgressPercentage(
  completedCount: number,
  total: number = BJJ_SKILLS.length,
): number {
  if (total <= 0) return 0;
  return Math.round((completedCount / total) * 100);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const WAIVER_TYPES = [
  "liability_release",
  "photo_release",
  "minor_consent",
  "general",
] as const;
export type WaiverType = (typeof WAIVER_TYPES)[number];

export const WAIVER_TYPE_LABEL: Record<WaiverType, string> = {
  liability_release: "Liability Release",
  photo_release: "Photo / Video Release",
  minor_consent: "Minor Consent",
  general: "General Waiver",
};

export function waiverTypeLabel(t: string): string {
  return WAIVER_TYPE_LABEL[t as WaiverType] ?? t;
}
