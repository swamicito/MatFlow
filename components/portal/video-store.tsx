"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
} from "lucide-react";
import { formatCents, formatDuration } from "@/lib/portal-utils";
import {
  claimFreeVideo,
  createInstructionalCheckoutPortal,
  type PortalPurchasableVideo,
} from "@/app/portal/actions";

export function VideoStore({
  studentId,
  videos,
  paymentsReady,
}: {
  studentId: string;
  videos: PortalPurchasableVideo[];
  paymentsReady: boolean;
}) {
  const searchParams = useSearchParams();
  const justPaid =
    searchParams.get("success") === "1" ||
    searchParams.get("checkout") === "success";

  return (
    <section className="space-y-3">
      {justPaid && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-200">
              Payment successful
            </p>
            <p className="text-xs text-emerald-300/70">
              The video will appear in your library below in a few seconds.
            </p>
          </div>
        </div>
      )}

      <h2 className="text-sm font-medium text-white">Available to Buy</h2>

      {!paymentsReady && videos.some((v) => !v.is_free && v.price_cents > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-200">
              Online payments aren&apos;t set up yet
            </p>
            <p className="text-xs text-amber-300/70">
              Your gym hasn&apos;t connected Stripe. Ask a coach to finish setup
              in Settings → Payments to buy videos online.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        {videos.map((v) => (
          <StoreCard
            key={v.id}
            video={v}
            studentId={studentId}
            paymentsReady={paymentsReady}
          />
        ))}
      </div>
    </section>
  );
}

function StoreCard({
  video,
  studentId,
  paymentsReady,
}: {
  video: PortalPurchasableVideo;
  studentId: string;
  paymentsReady: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const free = video.is_free || video.price_cents === 0;

  function handleAction() {
    startTransition(async () => {
      if (free) {
        const res = await claimFreeVideo(studentId, video.id);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("Added to your library");
        router.refresh();
        return;
      }

      const origin = window.location.origin;
      const res = await createInstructionalCheckoutPortal(
        studentId,
        video.id,
        `${origin}/portal/videos?success=1`,
        `${origin}/portal/videos`,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.push(res.url);
    });
  }

  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden flex gap-3 p-3 items-center">
      {/* Thumbnail */}
      <div className="relative h-16 w-28 rounded-lg overflow-hidden bg-[#111] shrink-0 flex items-center justify-center">
        {video.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail_url}
            alt={video.title}
            className="object-cover w-full h-full"
          />
        ) : (
          <Play className="h-6 w-6 text-[#333]" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium text-white truncate">{video.title}</p>
        <div className="flex items-center gap-2 text-[10px] text-[#555]">
          <span className="border border-[#222] rounded px-1.5 py-0.5">
            {video.category}
          </span>
          {video.duration_seconds && (
            <span className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {formatDuration(video.duration_seconds)}
            </span>
          )}
        </div>
        {video.description && (
          <p className="text-xs text-[#555] leading-relaxed line-clamp-2">
            {video.description}
          </p>
        )}
      </div>

      {/* Price + action */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <p className="text-base font-bold text-white">
          {free ? "Free" : formatCents(video.price_cents)}
        </p>
        {free ? (
          <button
            onClick={handleAction}
            disabled={pending}
            className="h-8 flex items-center gap-1.5 rounded-lg bg-white text-black text-xs font-semibold px-3 hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Watch"
            )}
          </button>
        ) : paymentsReady ? (
          <button
            onClick={handleAction}
            disabled={pending}
            className="h-8 flex items-center gap-1.5 rounded-lg bg-white text-black text-xs font-semibold px-3 hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                Buy
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        ) : (
          <span className="text-[10px] text-amber-400/80">Payments not set up</span>
        )}
      </div>
    </div>
  );
}
