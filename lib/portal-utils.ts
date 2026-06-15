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
  // ── Legacy / misc keys ────────────────────────────────────────────────────
  first_class:        { label: "First Class",     emoji: "🥋", description: "Attended your first class." },
  belt_promotion:     { label: "Belt Promotion",  emoji: "🥇", description: "Earned a new belt." },
  challenge_complete: { label: "Challenge",       emoji: "🎯", description: "Completed a gym challenge." },
  // old streak keys
  streak_7:  { label: "7-Day Streak",  emoji: "🔥", description: "Trained 7 days in a row." },
  streak_30: { label: "30-Day Streak", emoji: "⚡", description: "Trained 30 days in a row." },
  // old class keys
  classes_10:  { label: "10 Classes",  emoji: "💪", description: "Attended 10 classes." },
  classes_50:  { label: "50 Classes",  emoji: "🏆", description: "Attended 50 classes." },
  classes_100: { label: "Century",     emoji: "💯", description: "Attended 100 classes." },
  classes_250: { label: "250 Classes", emoji: "🦅", description: "Attended 250 classes." },

  // ── Attendance tiers (gamification.ts ATTENDANCE_TIERS: 10,25,50,100,250,500) ──
  attendance_10:  { label: "10 Classes",  emoji: "💪", description: "Attended 10 total classes." },
  attendance_25:  { label: "25 Classes",  emoji: "🔥", description: "Attended 25 total classes." },
  attendance_50:  { label: "50 Classes",  emoji: "🏆", description: "Attended 50 total classes." },
  attendance_100: { label: "Century",     emoji: "💯", description: "Attended 100 total classes." },
  attendance_250: { label: "250 Classes", emoji: "🦅", description: "Attended 250 total classes." },
  attendance_500: { label: "500 Classes", emoji: "👑", description: "Attended 500 total classes." },

  // ── Streak tiers (gamification.ts STREAK_TIERS: 4, 12 weeks) ──────────────
  streak_4:  { label: "30-Day Streak", emoji: "⚡", description: "Hit your weekly goal 4 weeks in a row." },
  streak_12: { label: "90-Day Streak", emoji: "🌟", description: "Hit your weekly goal 12 weeks in a row." },

  // ── Belt promotions (gamification.ts beltBadge) ───────────────────────────
  belt_gray:   { label: "Gray Belt",   emoji: "�", description: "Promoted to Gray belt." },
  belt_yellow: { label: "Yellow Belt", emoji: "🥋", description: "Promoted to Yellow belt." },
  belt_orange: { label: "Orange Belt", emoji: "🥋", description: "Promoted to Orange belt." },
  belt_green:  { label: "Green Belt",  emoji: "🥋", description: "Promoted to Green belt." },
  belt_blue:   { label: "Blue Belt",   emoji: "🥋", description: "Promoted to Blue belt." },
  belt_purple: { label: "Purple Belt", emoji: "🥋", description: "Promoted to Purple belt." },
  belt_brown:  { label: "Brown Belt",  emoji: "🥋", description: "Promoted to Brown belt." },
  belt_black:  { label: "Black Belt",  emoji: "🥇", description: "Promoted to Black belt." },
};

/** Lookup badge display metadata with a safe fallback. */
export function getBadgeMeta(key: string): { label: string; emoji: string; description: string } {
  return BADGE_META[key] ?? { label: key, emoji: "🏅", description: "" };
}

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
