"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Film,
  Lock,
  Play,
  ShoppingBag,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createInstructionalCheckout,
  getStudentOnDemandData,
  grantFreeAccess,
  saveWatchProgress,
  type StudentLibraryItem,
} from "@/app/(dashboard)/settings/ondemand/actions";
import {
  CATEGORY_LABEL,
  detectVideoSource,
  formatDuration,
  getEmbedUrl,
  getThumbnailUrl,
  isNewRelease,
  INSTRUCTIONAL_CATEGORIES,
  type InstructionalCategory,
} from "@/lib/ondemand";
import { formatMoney } from "@/lib/shop";

// ─────────────────────────────────────────────────────────────────────────────
// Main section
// ─────────────────────────────────────────────────────────────────────────────

export function OnDemandSection({
  studentId,
  enabled,
  stripeConfigured,
}: {
  studentId: string;
  enabled: boolean;
  stripeConfigured: boolean;
}) {
  const [catalogue, setCatalogue] = useState<StudentLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<InstructionalCategory | "all">("all");
  const [watchTarget, setWatchTarget] = useState<StudentLibraryItem | null>(null);
  const [buyTarget, setBuyTarget] = useState<StudentLibraryItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getStudentOnDemandData(studentId);
    setLoading(false);
    if (!res.ok) { setError(res.error); return; }
    setCatalogue(res.data.catalogue);
  }, [studentId]);

  useEffect(() => {
    if (!enabled || !studentId) return;
    setError(null);
    load();
  }, [studentId, enabled, load]);

  if (!enabled) return null;

  const filteredCatalogue =
    activeCategory === "all"
      ? catalogue
      : catalogue.filter((v) => v.category === activeCategory);

  const library = catalogue.filter(
    (v) => v.access_status === "owned" || v.access_status === "free",
  );
  const usedCategories = [
    ...new Set(catalogue.map((v) => v.category as InstructionalCategory)),
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs uppercase tracking-wider text-[#888]">
          On-Demand
        </h3>
        {library.length > 0 && (
          <span className="text-[11px] text-emerald-300 border border-emerald-500/40 bg-emerald-500/10 rounded-full px-2 py-0.5 flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {library.length} in library
          </span>
        )}
      </div>

      {loading && catalogue.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-[#1f1f1f] bg-black overflow-hidden">
              <Skeleton className="aspect-video w-full bg-[#1a1a1a]" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4 bg-[#1a1a1a]" />
                <Skeleton className="h-3 w-1/2 bg-[#1a1a1a]" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error.includes("instructionals") || error.includes("relation") ? (
            <>
              On-demand tables are missing. Apply{" "}
              <code className="text-white">supabase/migrations/0009_ondemand.sql</code>.
            </>
          ) : (
            error
          )}
        </div>
      ) : catalogue.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#1f1f1f] p-6 text-center text-sm text-[#666]">
          No videos published yet. The coach can upload content at{" "}
          <span className="text-white">Settings → On-Demand</span>.
        </div>
      ) : (
        <div className="space-y-3">
          {/* Category filter pills */}
          {usedCategories.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              <CategoryPill
                label="All"
                active={activeCategory === "all"}
                onClick={() => setActiveCategory("all")}
              />
              {usedCategories.map((c) => (
                <CategoryPill
                  key={c}
                  label={CATEGORY_LABEL[c]}
                  active={activeCategory === c}
                  onClick={() => setActiveCategory(c)}
                />
              ))}
            </div>
          )}

          {/* Video grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredCatalogue.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                stripeConfigured={stripeConfigured}
                onWatch={() => setWatchTarget(v)}
                onBuy={() => setBuyTarget(v)}
                onClaimFree={async () => {
                  await grantFreeAccess(studentId, v.id);
                  load();
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Watch dialog */}
      {watchTarget && (
        <WatchDialog
          video={watchTarget}
          studentId={studentId}
          onClose={() => { setWatchTarget(null); load(); }}
        />
      )}

      {/* Buy dialog */}
      {buyTarget && (
        <BuyDialog
          video={buyTarget}
          studentId={studentId}
          stripeConfigured={stripeConfigured}
          onClose={() => setBuyTarget(null)}
          onPurchased={() => { setBuyTarget(null); load(); }}
        />
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Category pill
// ─────────────────────────────────────────────────────────────────────────────

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs rounded-full border px-3 py-1 transition-colors",
        active
          ? "bg-white text-black border-white"
          : "border-[#222] text-[#888] hover:text-white hover:border-[#333]",
      )}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video card
// ─────────────────────────────────────────────────────────────────────────────

function VideoCard({
  video: v,
  stripeConfigured,
  onWatch,
  onBuy,
  onClaimFree,
}: {
  video: StudentLibraryItem;
  stripeConfigured: boolean;
  onWatch: () => void;
  onBuy: () => void;
  onClaimFree: () => void;
}) {
  const thumb = getThumbnailUrl(v.thumbnail_url, v.video_url ?? "");
  const hasAccess = v.access_status !== "none";
  const pct = v.progress?.completed_pct ?? 0;
  const isNew = isNewRelease(v.published_at);

  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-black overflow-hidden">
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[#111] overflow-hidden group">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={v.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Film className="h-8 w-8 text-[#333]" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />

        {hasAccess ? (
          <button
            type="button"
            onClick={onWatch}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="h-12 w-12 rounded-full bg-white text-black grid place-items-center shadow-lg group-hover:scale-105 transition-transform">
              <Play className="h-5 w-5 ml-0.5" fill="currentColor" />
            </div>
          </button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Lock className="h-8 w-8 text-white/40" />
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {isNew && (
            <span className="text-[9px] uppercase tracking-widest bg-white text-black rounded-full px-1.5 py-0.5 font-semibold">
              New
            </span>
          )}
          {v.progress?.completed && (
            <span className="text-[9px] uppercase tracking-widest bg-emerald-500 text-white rounded-full px-1.5 py-0.5 flex items-center gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> Done
            </span>
          )}
        </div>

        {v.duration_seconds && (
          <span className="absolute bottom-2 right-2 text-[10px] bg-black/70 text-white rounded px-1.5 py-0.5">
            {formatDuration(v.duration_seconds)}
          </span>
        )}

        {/* Progress bar */}
        {pct > 0 && pct < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div
              className="h-full bg-white/80 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div>
          <p className="text-white text-sm font-medium">{v.title}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[#666]">
            <span>{CATEGORY_LABEL[v.category as InstructionalCategory]}</span>
            {v.duration_seconds && (
              <>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDuration(v.duration_seconds)}
                </span>
              </>
            )}
            {pct > 0 && <><span>·</span><span>{pct}% watched</span></>}
          </div>
        </div>

        {!hasAccess && (
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold tabular-nums">
              {v.is_free || v.price_cents === 0 ? "Free" : formatMoney(v.price_cents)}
            </span>
            {v.is_free || v.price_cents === 0 ? (
              <Button
                size="sm"
                onClick={onClaimFree}
                className="bg-white text-black hover:bg-white/90 h-7"
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Watch free
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onBuy}
                className="bg-white text-black hover:bg-white/90 h-7"
              >
                <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                {stripeConfigured ? "Buy" : "Request access"}
              </Button>
            )}
          </div>
        )}

        {hasAccess && (
          <Button
            size="sm"
            onClick={onWatch}
            variant="outline"
            className="w-full border-[#222] bg-transparent text-white hover:bg-[#111] h-8"
          >
            <Play className="h-3.5 w-3.5 mr-1.5" />
            {pct > 0 ? "Continue watching" : "Watch now"}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Watch dialog — inline video player
// ─────────────────────────────────────────────────────────────────────────────

function WatchDialog({
  video,
  studentId,
  onClose,
}: {
  video: StudentLibraryItem;
  studentId: string;
  onClose: () => void;
}) {
  const src = detectVideoSource(video.video_url ?? "");
  const embedUrl = getEmbedUrl(
    video.video_url ?? "",
    video.progress?.position_seconds ?? 0,
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleProgressSave(positionSeconds: number) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveWatchProgress(
        studentId,
        video.id,
        Math.round(positionSeconds),
        video.duration_seconds,
      ).catch(() => {/* best-effort */});
    }, 5000);
  }

  function handleTimeUpdate() {
    const vid = videoRef.current;
    if (!vid) return;
    scheduleProgressSave(vid.currentTime);
  }

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // Save on unmount if direct video
      if (videoRef.current) {
        saveWatchProgress(
          studentId,
          video.id,
          Math.round(videoRef.current.currentTime),
          video.duration_seconds,
        ).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white max-w-3xl p-0 overflow-hidden">
        <div className="p-4 pb-0">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 pr-8">
              <span className="truncate">{video.title}</span>
              <span className="text-[10px] uppercase tracking-widest border border-[#222] text-[#888] rounded-full px-2 py-0.5 shrink-0">
                {CATEGORY_LABEL[video.category as InstructionalCategory]}
              </span>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Player */}
        <div className="aspect-video bg-black">
          {src === "youtube" || src === "vimeo" ? (
            embedUrl ? (
              <iframe
                src={embedUrl}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="w-full h-full"
              />
            ) : (
              <PlayerFallback url={video.video_url ?? ""} />
            )
          ) : (
            <video
              ref={videoRef}
              src={video.video_url ?? undefined}
              controls
              className="w-full h-full"
              onTimeUpdate={handleTimeUpdate}
            />
          )}
        </div>

        {/* Meta */}
        <div className="p-4 space-y-2">
          {video.description && (
            <p className="text-sm text-[#aaa]">{video.description}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-[#666]">
            {video.duration_seconds && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(video.duration_seconds)}
              </span>
            )}
            {video.progress && (
              <span>{video.progress.completed_pct}% completed</span>
            )}
            {(src === "youtube" || src === "vimeo") && (
              <span className="text-[#444] italic">
                Progress auto-saved when you close this window.
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PlayerFallback({ url }: { url: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Film className="h-10 w-10 text-[#333]" />
      <p className="text-sm text-[#888]">Could not embed this video.</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-white underline underline-offset-2"
      >
        Open in new tab
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Buy dialog
// ─────────────────────────────────────────────────────────────────────────────

function BuyDialog({
  video,
  studentId,
  stripeConfigured,
  onClose,
  onPurchased,
}: {
  video: StudentLibraryItem;
  studentId: string;
  stripeConfigured: boolean;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function buy() {
    startTransition(async () => {
      if (!stripeConfigured) {
        toast.info("Contact the front desk to purchase access to this video.");
        onClose();
        return;
      }
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const res = await createInstructionalCheckout(
        studentId,
        video.id,
        `${origin}/students`,
        `${origin}/students`,
      );
      if (!res.ok) { toast.error(res.error); return; }
      window.location.href = res.data.url;
    });
  }

  const thumb = getThumbnailUrl(video.thumbnail_url, video.video_url ?? "");

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Unlock this video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {thumb && (
            <div className="aspect-video rounded-md overflow-hidden bg-[#111]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
            </div>
          )}

          <div className="rounded-lg border border-[#1f1f1f] bg-black p-4 space-y-1">
            <p className="text-white font-medium">{video.title}</p>
            {video.description && (
              <p className="text-xs text-[#888]">{video.description}</p>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm text-[#aaa]">Price</span>
              <span className="text-white font-semibold tabular-nums">
                {formatMoney(video.price_cents)}
              </span>
            </div>
            {video.duration_seconds && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#666]">Duration</span>
                <span className="text-white">{formatDuration(video.duration_seconds)}</span>
              </div>
            )}
          </div>

          {!stripeConfigured && (
            <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-3 text-xs text-[#888]">
              Online payments are not configured. Contact the front desk to
              purchase access.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={pending}
              className="border-[#333] bg-transparent text-white hover:bg-[#111]"
            >
              Cancel
            </Button>
            <Button
              onClick={buy}
              disabled={pending}
              className="bg-white text-black hover:bg-white/90"
            >
              {pending
                ? "Processing…"
                : stripeConfigured
                  ? `Pay ${formatMoney(video.price_cents)}`
                  : "Contact front desk"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
