/**
 * On-Demand Instructionals helpers: categories, video detection, formatting.
 */

export type InstructionalCategory =
  | "technique"
  | "full_class"
  | "belt_specific"
  | "competition_prep"
  | "conditioning"
  | "mindset";

export const INSTRUCTIONAL_CATEGORIES: InstructionalCategory[] = [
  "technique",
  "full_class",
  "belt_specific",
  "competition_prep",
  "conditioning",
  "mindset",
];

export const CATEGORY_LABEL: Record<InstructionalCategory, string> = {
  technique: "Technique",
  full_class: "Full Class",
  belt_specific: "Belt-Specific",
  competition_prep: "Competition Prep",
  conditioning: "Conditioning",
  mindset: "Mindset",
};

export const CATEGORY_DESCRIPTION: Record<InstructionalCategory, string> = {
  technique: "Single technique breakdowns",
  full_class: "Complete recorded class",
  belt_specific: "Curriculum for a specific belt",
  competition_prep: "Tournament preparation",
  conditioning: "Strength & conditioning",
  mindset: "Mental game & strategy",
};

export type VideoVisibility = "public" | "gym_only";

export const VISIBILITY_LABEL: Record<VideoVisibility, string> = {
  public: "Public",
  gym_only: "Gym Only",
};

/** Detect what kind of URL we have to choose the right player. */
export type VideoSource = "youtube" | "vimeo" | "direct";

export function detectVideoSource(url: string): VideoSource {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  return "direct";
}

/** Extract YouTube video ID from various URL shapes. */
function youtubeId(url: string): string | null {
  const m =
    url.match(/youtu\.be\/([^?&]+)/) ??
    url.match(/[?&]v=([^&]+)/) ??
    url.match(/embed\/([^?&]+)/);
  return m?.[1] ?? null;
}

/** Extract Vimeo video ID. */
function vimeoId(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m?.[1] ?? null;
}

/**
 * Build an embed URL for iframes. Returns null for direct/storage videos
 * (use <video> tag instead).
 * @param startSeconds Optional resume position in seconds.
 */
export function getEmbedUrl(
  url: string,
  startSeconds = 0,
): string | null {
  const src = detectVideoSource(url);
  if (src === "youtube") {
    const id = youtubeId(url);
    if (!id) return null;
    const params = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      ...(startSeconds > 0 ? { start: String(Math.round(startSeconds)) } : {}),
    });
    return `https://www.youtube.com/embed/${id}?${params}`;
  }
  if (src === "vimeo") {
    const id = vimeoId(url);
    if (!id) return null;
    const params = new URLSearchParams({
      ...(startSeconds > 0 ? { t: String(Math.round(startSeconds)) } : {}),
    });
    return `https://player.vimeo.com/video/${id}?${params}`;
  }
  return null;
}

/** Format seconds → "mm:ss" or "h:mm:ss". */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Parse a "mm:ss" or "h:mm:ss" string into total seconds. */
export function parseDuration(str: string): number {
  const parts = str.trim().split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  if (parts.length === 2) return (parts[0]! * 60) + parts[1]!;
  if (parts.length === 3) return (parts[0]! * 3600) + (parts[1]! * 60) + parts[2]!;
  return 0;
}

/** True if a video was published within the last 14 days. */
export function isNewRelease(publishedAt: string | null | undefined): boolean {
  if (!publishedAt) return false;
  return Date.now() - new Date(publishedAt).getTime() < 14 * 24 * 60 * 60 * 1000;
}

/** Get a thumbnail URL — falls back to YouTube auto-thumb. */
export function getThumbnailUrl(
  thumbnailUrl: string | null | undefined,
  videoUrl: string,
): string | null {
  if (thumbnailUrl) return thumbnailUrl;
  if (detectVideoSource(videoUrl) === "youtube") {
    const id = youtubeId(videoUrl);
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}

/** Category presets for quick-fill when uploading. */
export const DURATION_PRESETS = [
  { label: "5 min", seconds: 300 },
  { label: "10 min", seconds: 600 },
  { label: "15 min", seconds: 900 },
  { label: "30 min", seconds: 1800 },
  { label: "45 min", seconds: 2700 },
  { label: "60 min", seconds: 3600 },
  { label: "90 min", seconds: 5400 },
];
