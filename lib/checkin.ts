/**
 * Class types selectable on the tablet check-in screen. Stored on
 * `attendance.class_type` as a plain string so we can evolve this list later
 * without a migration.
 */
export const CLASS_TYPES = [
  "Open Mat",
  "Fundamentals",
  "All Levels",
  "Kids",
  "No-Gi",
  "Competition",
] as const;

export type ClassType = (typeof CLASS_TYPES)[number];

export const DEFAULT_CLASS: ClassType = "Open Mat";

/**
 * Static fallback schedule used until the `/schedule` module ships with a
 * real `classes` table.
 */
export const TODAYS_CLASSES: { time: string; label: string }[] = [
  { time: "6:00 AM", label: "Fundamentals" },
  { time: "12:00 PM", label: "Open Mat" },
  { time: "5:30 PM", label: "Kids" },
  { time: "6:30 PM", label: "All Levels" },
  { time: "7:30 PM", label: "No-Gi" },
  { time: "8:30 PM", label: "Competition" },
];

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
}
