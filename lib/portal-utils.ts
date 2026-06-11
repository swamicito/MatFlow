import type { BeltRank } from "@/lib/supabase/types";

export const BELT_COLORS: Record<BeltRank, string> = {
  white: "#e5e5e5",
  gray: "#9ca3af",
  yellow: "#eab308",
  orange: "#f97316",
  green: "#22c55e",
  blue: "#3b82f6",
  purple: "#a855f7",
  brown: "#92400e",
  black: "#f5f5f5",
};

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

export const BADGE_META: Record<string, { label: string; emoji: string; description: string }> = {
  first_class: { label: "First Class", emoji: "🥋", description: "Attended your first class" },
  streak_7: { label: "7-Day Streak", emoji: "🔥", description: "Trained 7 days in a row" },
  streak_30: { label: "30-Day Streak", emoji: "⚡", description: "Trained 30 days in a row" },
  classes_10: { label: "10 Classes", emoji: "💪", description: "Attended 10 classes" },
  classes_50: { label: "50 Classes", emoji: "🏆", description: "Attended 50 classes" },
  classes_100: { label: "Century", emoji: "💯", description: "Attended 100 classes" },
  classes_250: { label: "250 Classes", emoji: "🦅", description: "Attended 250 classes" },
  belt_promotion: { label: "Belt Promotion", emoji: "🥇", description: "Earned a new belt" },
  challenge_complete: { label: "Challenge", emoji: "🎯", description: "Completed a gym challenge" },
};

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
