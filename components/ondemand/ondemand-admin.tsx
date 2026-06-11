"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Edit2,
  Eye,
  EyeOff,
  Film,
  Plus,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createInstructional,
  deleteInstructional,
  updateInstructional,
  type InstructionalInput,
  type OnDemandStats,
} from "@/app/(dashboard)/settings/ondemand/actions";
import {
  CATEGORY_LABEL,
  DURATION_PRESETS,
  formatDuration,
  getThumbnailUrl,
  INSTRUCTIONAL_CATEGORIES,
  isNewRelease,
  VISIBILITY_LABEL,
  type InstructionalCategory,
  type VideoVisibility,
} from "@/lib/ondemand";
import { formatMoney } from "@/lib/shop";
import type { Database } from "@/lib/supabase/types";

type Instructional = Database["public"]["Tables"]["instructionals"]["Row"];

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

const DEFAULT_INPUT: InstructionalInput = {
  title: "",
  description: null,
  category: "technique",
  price_cents: 0,
  duration_seconds: null,
  video_url: "",
  thumbnail_url: null,
  visibility: "gym_only",
  is_free: true,
  sort_order: 0,
  published_at: null,
};

export function OnDemandAdmin({
  initialVideos,
  stats,
}: {
  initialVideos: Instructional[];
  stats: OnDemandStats | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editTarget, setEditTarget] = useState<Instructional | null>(null);
  const [showNew, setShowNew] = useState(false);

  function refresh() { router.refresh(); }

  function togglePublished(v: Instructional) {
    startTransition(async () => {
      const r = await updateInstructional(v.id, {
        published_at: v.published_at ? null : new Date().toISOString(),
      });
      if (!r.ok) toast.error(r.error);
      else refresh();
    });
  }

  function remove(v: Instructional) {
    if (!confirm(`Delete "${v.title}"? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteInstructional(v.id);
      if (!r.ok) toast.error(r.error);
      else { toast.success("Video deleted"); refresh(); }
    });
  }

  return (
    <div className="space-y-6">
      {stats && <StatsBar stats={stats} />}

      <div className="flex items-center justify-between">
        <p className="text-xs text-[#666]">
          {initialVideos.length} videos ·{" "}
          {initialVideos.filter((v) => v.published_at).length} published
        </p>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add video
        </Button>
      </div>

      {initialVideos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#1f1f1f] p-12 text-center">
          <Film className="h-8 w-8 text-[#444] mx-auto mb-2" />
          <p className="text-sm text-[#888]">
            No videos yet. Paste a YouTube or Vimeo URL to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initialVideos.map((v) => (
            <VideoCard
              key={v.id}
              video={v}
              disabled={pending}
              onEdit={() => setEditTarget(v)}
              onTogglePublished={() => togglePublished(v)}
              onDelete={() => remove(v)}
            />
          ))}
        </div>
      )}

      <VideoDialog
        open={showNew || !!editTarget}
        onOpenChange={(open) => { if (!open) { setShowNew(false); setEditTarget(null); } }}
        initial={editTarget ?? undefined}
        onSaved={refresh}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: OnDemandStats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: "Revenue", value: formatMoney(stats.totalRevenueCents), sub: `${stats.totalSales} sales` },
        { label: "Videos", value: String(stats.totalVideos), sub: "published" },
        { label: "Completions", value: String(stats.completionCount), sub: "all time" },
      ].map((s) => (
        <div key={s.label} className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4">
          <div className="flex items-center gap-2 text-[#888] text-[11px] uppercase tracking-widest mb-1">
            <TrendingUp className="h-3.5 w-3.5" />
            {s.label}
          </div>
          <div className="text-xl font-semibold text-white">{s.value}</div>
          <div className="text-[10px] text-[#666]">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function VideoCard({
  video: v,
  disabled,
  onEdit,
  onTogglePublished,
  onDelete,
}: {
  video: Instructional;
  disabled: boolean;
  onEdit: () => void;
  onTogglePublished: () => void;
  onDelete: () => void;
}) {
  const thumb = getThumbnailUrl(v.thumbnail_url, v.video_url ?? "");
  const isNew = isNewRelease(v.published_at);

  return (
    <div className={cn(
      "rounded-lg border bg-[#0a0a0a] overflow-hidden",
      v.published_at ? "border-[#1f1f1f]" : "border-[#111] opacity-60",
    )}>
      {/* Thumbnail */}
      <div className="relative aspect-video bg-[#111] overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={v.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center">
            <Film className="h-8 w-8 text-[#333]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {isNew && (
            <span className="text-[9px] uppercase tracking-widest bg-white text-black rounded-full px-1.5 py-0.5 font-semibold">
              New
            </span>
          )}
          {v.duration_seconds && (
            <span className="text-[10px] bg-black/70 text-white rounded px-1.5 py-0.5">
              {formatDuration(v.duration_seconds)}
            </span>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-white font-medium truncate">{v.title}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-[10px] uppercase tracking-widest border border-[#222] text-[#888] rounded-full px-2 py-0.5">
                {CATEGORY_LABEL[v.category as InstructionalCategory]}
              </span>
              <span className="text-[10px] text-[#666]">
                {VISIBILITY_LABEL[v.visibility as VideoVisibility]}
              </span>
            </div>
          </div>
          <span className="text-white font-semibold tabular-nums shrink-0">
            {v.is_free || v.price_cents === 0 ? "Free" : formatMoney(v.price_cents)}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={disabled}
            onClick={onTogglePublished}
            className="inline-flex items-center gap-1.5 text-xs text-[#aaa] hover:text-white"
          >
            {v.published_at ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {v.published_at ? "Published" : "Draft"}
          </button>
          <Button
            size="sm" variant="outline" disabled={disabled} onClick={onEdit}
            className="border-[#333] bg-transparent text-white hover:bg-[#111] h-7 px-2"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm" variant="outline" disabled={disabled} onClick={onDelete}
            className="border-[#333] bg-transparent text-white hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40 h-7 px-2"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function VideoDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Instructional;
  onSaved: () => void;
}) {
  const isEdit = !!initial;
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<InstructionalInput>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          category: initial.category as InstructionalCategory,
          price_cents: initial.price_cents,
          duration_seconds: initial.duration_seconds,
          video_url: initial.video_url ?? "",
          thumbnail_url: initial.thumbnail_url,
          visibility: initial.visibility as VideoVisibility,
          is_free: initial.is_free,
          sort_order: initial.sort_order,
          published_at: initial.published_at,
        }
      : { ...DEFAULT_INPUT },
  );

  function set<K extends keyof InstructionalInput>(k: K, v: InstructionalInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const dollars = (c: number | null | undefined) => (c != null ? String(c / 100) : "");
  const parseCents = (v: string) => {
    const n = parseFloat(v || "0");
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  };

  function submit() {
    startTransition(async () => {
      const res = isEdit
        ? await updateInstructional(initial!.id, form)
        : await createInstructional(form);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(isEdit ? "Video updated" : "Video added");
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit video" : "Add video"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Video URL <span className="text-[#555]">(YouTube, Vimeo, or direct MP4)</span></Label>
            <Input
              value={form.video_url}
              onChange={(e) => set("video_url", e.target.value)}
              className={inputCls}
              placeholder="https://youtu.be/… or https://vimeo.com/…"
            />
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className={inputCls}
              placeholder="e.g. Triangle Choke from Closed Guard"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => v && set("category", v as InstructionalCategory)}
              >
                <SelectTrigger className="bg-black border-[#222] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
                  {INSTRUCTIONAL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="focus:bg-[#111] focus:text-white">
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => v && set("visibility", v as VideoVisibility)}
              >
                <SelectTrigger className="bg-black border-[#222] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
                  {(["gym_only", "public"] as VideoVisibility[]).map((vis) => (
                    <SelectItem key={vis} value={vis} className="focus:bg-[#111] focus:text-white">
                      {VISIBILITY_LABEL[vis]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex gap-2 flex-wrap">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => set("duration_seconds", p.seconds)}
                  className={cn(
                    "text-sm rounded-md border px-3 py-1.5 transition-colors",
                    form.duration_seconds === p.seconds
                      ? "border-white bg-white text-black"
                      : "border-[#222] bg-black hover:bg-[#111] hover:border-[#333]",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {form.duration_seconds && (
              <p className="text-xs text-[#666]">{formatDuration(form.duration_seconds)} selected</p>
            )}
          </div>

          {/* Pricing */}
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_free}
                onChange={(e) => {
                  set("is_free", e.target.checked);
                  if (e.target.checked) set("price_cents", 0);
                }}
                className="h-4 w-4 rounded border-[#333] bg-black accent-white"
              />
              <span className="text-sm text-[#ccc]">Free to watch (no purchase required)</span>
            </label>

            {!form.is_free && (
              <div className="space-y-2">
                <Label>Price ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={dollars(form.price_cents)}
                  onChange={(e) => set("price_cents", parseCents(e.target.value))}
                  className={inputCls}
                  placeholder="29.99"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Thumbnail URL <span className="text-[#555]">(optional — auto-detected for YouTube)</span></Label>
            <Input
              value={form.thumbnail_url ?? ""}
              onChange={(e) => set("thumbnail_url", e.target.value || null)}
              className={inputCls}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              className={inputCls}
              placeholder="What students will learn…"
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.published_at}
              onChange={(e) =>
                set("published_at", e.target.checked ? new Date().toISOString() : null)
              }
              className="h-4 w-4 rounded border-[#333] bg-black accent-white"
            />
            <span className="text-sm text-[#ccc]">Published (visible to students)</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#333] bg-transparent text-white hover:bg-[#111]"
            >
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={pending || !form.title || !form.video_url}
              className="bg-white text-black hover:bg-white/90"
            >
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add video"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
