/**
 * /embed/schedule/[gymSlug]
 *
 * Public, read-only schedule embed.  Designed to be dropped into any gym's
 * website via an <iframe>.  Requires no authentication.
 *
 * Security:
 *   - Only exposes class data for the requested gym (scoped by gym_id).
 *   - No mutations — SELECT only.
 *   - iframe embedding is allowed by the Content-Security-Policy headers set
 *     in next.config.ts for the /embed/* path pattern.
 *
 * Performance:
 *   - ISR with a 5-minute revalidation window so schedule changes appear
 *     quickly without hitting Supabase on every request.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmbedResizer } from "@/components/embed/embed-resizer";

// ── ISR cache — rebuild page at most once per 5 minutes ────────────────────
export const revalidate = 300;

// ── Constants ───────────────────────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];

// Display order: Monday → Saturday → Sunday
const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

// ── Types ────────────────────────────────────────────────────────────────────

type GymRow = {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
};

type ClassRow = {
  id: string;
  title: string;
  instructor_name: string;
  day_of_week: number;
  start_time: string;   // "HH:MM:SS"
  end_time: string;
  capacity: number;
  spots_left: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Converts "HH:MM:SS" (24-h) → "6:00 PM" (12-h). */
function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Returns true when a hex colour is perceptually light (luminance > 50 %).
 * Used to decide whether the CTA button needs black or white text.
 */
function isLight(hex: string): boolean {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return true;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: { gymSlug: string };
}): Promise<Metadata> {
  const admin = createAdminClient() as any;
  const { data: gym } = await admin
    .from("gyms")
    .select("name")
    .eq("slug", params.gymSlug)
    .maybeSingle();

  const title = gym ? `${gym.name} — Class Schedule` : "Class Schedule";
  return { title, robots: { index: false } };
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchEmbedData(gymSlug: string): Promise<{
  gym: GymRow | null;
  byDay: Record<number, ClassRow[]>;
  activeDays: number[];
}> {
  const admin = createAdminClient() as any;

  // 1. Resolve gym — only fetch publicly safe fields.
  const { data: gym } = await admin
    .from("gyms")
    .select("id, name, slug, primary_color")
    .eq("slug", gymSlug)
    .maybeSingle();

  // Return null gym so the page can render a clean branded error state
  // instead of triggering the app's global 404 (which has dashboard chrome).
  if (!gym) return { gym: null, byDay: {}, activeDays: [] };

  // 2. Fetch all classes for this gym, ordered for display.
  const { data: classRows } = await admin
    .from("classes")
    .select(
      "id, title, instructor_name, day_of_week, start_time, end_time, capacity",
    )
    .eq("gym_id", gym.id)
    .order("day_of_week", { ascending: true })
    .order("start_time",  { ascending: true });

  const classes: any[] = classRows ?? [];

  // 3. Fetch confirmed booking counts to compute spots remaining.
  let countMap: Record<string, number> = {};
  if (classes.length > 0) {
    const classIds = classes.map((c) => c.id);
    const { data: bookings } = await admin
      .from("class_bookings")
      .select("class_id")
      .in("class_id", classIds)
      .eq("status", "confirmed");

    for (const b of bookings ?? []) {
      countMap[b.class_id] = (countMap[b.class_id] ?? 0) + 1;
    }
  }

  // 4. Enrich with spots_left and group by day.
  const byDay: Record<number, ClassRow[]> = {};
  for (const c of classes) {
    const enriched: ClassRow = {
      ...c,
      spots_left: Math.max(0, c.capacity - (countMap[c.id] ?? 0)),
    };
    if (!byDay[c.day_of_week]) byDay[c.day_of_week] = [];
    byDay[c.day_of_week].push(enriched);
  }

  const activeDays = DAY_DISPLAY_ORDER.filter((d) => byDay[d]?.length > 0);

  return { gym, byDay, activeDays };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SpotsBadge({ spots }: { spots: number }) {
  if (spots <= 0) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        Full
      </span>
    );
  }
  if (spots <= 3) {
    return (
      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        {spots} spot{spots !== 1 ? "s" : ""} left
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
      {spots} spots left
    </span>
  );
}

function ClassCard({
  cls,
  accentColor,
  btnTextColor,
  signUpUrl,
}: {
  cls: ClassRow;
  accentColor: string;
  btnTextColor: string;
  signUpUrl: string;
}) {
  return (
    <div className="group flex items-center gap-4 rounded-xl border border-[#1f1f1f] bg-[#111] px-4 py-3.5 transition-colors hover:border-[#2a2a2a] hover:bg-[#161616]">
      {/* Time column */}
      <div className="w-28 shrink-0 text-right">
        <p className="text-sm font-medium text-white tabular-nums">
          {fmtTime(cls.start_time)}
        </p>
        <p className="text-xs text-[#6B7280] tabular-nums">
          – {fmtTime(cls.end_time)}
        </p>
      </div>

      {/* Divider */}
      <div className="w-px h-10 bg-[#2a2a2a] shrink-0" />

      {/* Class info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight truncate">
          {cls.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {cls.instructor_name && (
            <span className="text-xs text-[#6B7280]">{cls.instructor_name}</span>
          )}
          <SpotsBadge spots={cls.spots_left} />
        </div>
      </div>

      {/* CTA */}
      <a
        href={signUpUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ backgroundColor: accentColor, color: btnTextColor }}
        className="shrink-0 inline-flex items-center justify-center rounded-lg px-3.5 h-8 text-xs font-semibold transition-opacity hover:opacity-80 whitespace-nowrap"
      >
        Sign up at MatFlow
      </a>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EmbedSchedulePage({
  params,
}: {
  params: { gymSlug: string };
}) {
  const { gym, byDay, activeDays } = await fetchEmbedData(params.gymSlug);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mat-flow.net";

  // ── Invalid slug → clean branded error state ───────────────────────────────
  if (!gym) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white antialiased flex flex-col items-center justify-center px-6">
        <EmbedResizer />
        <div className="text-center max-w-xs">
          <div className="w-12 h-12 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mx-auto mb-5">
            <span className="text-xl">📅</span>
          </div>
          <h1 className="text-base font-bold text-white mb-2">Schedule not found</h1>
          <p className="text-sm text-[#6B7280] mb-7 leading-relaxed">
            This schedule link may be incorrect or the gym may no longer be active.
          </p>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg px-5 h-9 text-xs font-semibold bg-white text-black hover:opacity-80 transition-opacity"
          >
            Go to MatFlow
          </a>
        </div>
        <p className="absolute bottom-5 text-[10px] text-[#2a2a2a]">
          Powered by MatFlow
        </p>
      </div>
    );
  }

  // Resolve branding — fall back to white when not set.
  const accentColor = gym.primary_color || "#ffffff";
  const btnTextColor = isLight(accentColor) ? "#000000" : "#ffffff";

  // Include the gym slug in the sign-up URL for future ?gym= support on the login page.
  const signUpUrl = `${siteUrl}/login?gym=${encodeURIComponent(gym.slug)}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white antialiased">
      {/* Sends document height to the parent iframe on mount and on resize */}
      <EmbedResizer />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <header className="mb-8 pb-5 border-b border-[#1f1f1f]">
          <h1 className="text-xl font-bold text-white tracking-tight">
            {gym.name}
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">Weekly Class Schedule</p>
        </header>

        {/* ── Schedule ──────────────────────────────────────────────────── */}
        {activeDays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm font-medium text-white">No classes yet</p>
            <p className="text-xs text-[#555] mt-1">
              Check back soon — the schedule is being set up.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {activeDays.map((day) => (
              <section key={day}>
                {/* Day header */}
                <h2 className="text-[10px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">
                  {DAY_NAMES[day]}
                </h2>

                {/* Class list */}
                <div className="space-y-2">
                  {byDay[day].map((cls) => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      accentColor={accentColor}
                      btnTextColor={btnTextColor}
                      signUpUrl={signUpUrl}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <footer className="mt-12 pt-5 border-t border-[#111] text-center">
          <a
            href="https://mat-flow.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-[#2a2a2a] hover:text-[#555] transition-colors"
          >
            Powered by MatFlow
          </a>
        </footer>

      </div>
    </div>
  );
}
