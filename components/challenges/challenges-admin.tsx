"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trophy, Trash2, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  createChallenge,
  deleteChallenge,
  getChallengeLeaderboard,
  setChallengeEnabled,
  type ChallengeAdminRow,
  type LeaderboardRow,
} from "@/app/(dashboard)/students/gamification-actions";

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

const PRESETS: {
  title: string;
  description: string;
  target_classes: number;
  duration_days: number;
}[] = [
  {
    title: "4-Week Challenge",
    description: "Hit 12 classes in 28 days. Build the habit.",
    target_classes: 12,
    duration_days: 28,
  },
  {
    title: "Belt Promotion Sprint",
    description: "16 classes in 6 weeks. Earn a stripe.",
    target_classes: 16,
    duration_days: 42,
  },
  {
    title: "No-Gi November",
    description: "8 no-gi classes in November.",
    target_classes: 8,
    duration_days: 30,
  },
];

export function ChallengesAdmin({ initial }: { initial: ChallengeAdminRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [leaderFor, setLeaderFor] = useState<ChallengeAdminRow | null>(null);

  function refresh() {
    router.refresh();
  }

  function toggle(id: string, enabled: boolean) {
    startTransition(async () => {
      const r = await setChallengeEnabled(id, enabled);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success(enabled ? "Challenge enabled" : "Challenge disabled");
        refresh();
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this challenge? Participant progress will be lost.")) return;
    startTransition(async () => {
      const r = await deleteChallenge(id);
      if (!r.ok) toast.error(r.error);
      else {
        toast.success("Challenge deleted");
        refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#666]">
          {initial.length} total · {initial.filter((c) => c.enabled).length} active
        </p>
        <Button
          onClick={() => setShowNew(true)}
          className="bg-white text-black hover:bg-white/90"
        >
          <Plus className="h-4 w-4 mr-1" />
          New challenge
        </Button>
      </div>

      {initial.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No challenges yet"
          description="Create a time-limited training challenge to keep students accountable and track the leaderboard."
          action={
            <Button
              onClick={() => setShowNew(true)}
              className="bg-white text-black hover:bg-white/90"
            >
              <Plus className="h-4 w-4 mr-1" />
              New challenge
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {initial.map((c) => (
            <ChallengeCard
              key={c.id}
              row={c}
              disabled={pending}
              onToggle={() => toggle(c.id, !c.enabled)}
              onDelete={() => remove(c.id)}
              onLeaderboard={() => setLeaderFor(c)}
            />
          ))}
        </div>
      )}

      <NewChallengeDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={refresh}
      />

      <LeaderboardDialog
        challenge={leaderFor}
        onOpenChange={(o) => !o && setLeaderFor(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ChallengeCard({
  row,
  disabled,
  onToggle,
  onDelete,
  onLeaderboard,
}: {
  row: ChallengeAdminRow;
  disabled: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onLeaderboard: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const status =
    today < row.start_date
      ? "Upcoming"
      : today > row.end_date
        ? "Ended"
        : "Active";
  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium">{row.title}</p>
          {row.description && (
            <p className="text-xs text-[#888] mt-0.5">{row.description}</p>
          )}
          <p className="text-[10px] text-[#666] tabular-nums mt-1">
            {row.start_date} → {row.end_date} · target {row.target_classes}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
            status === "Active"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : status === "Upcoming"
                ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                : "border-[#222] bg-black text-[#888]",
          )}
        >
          {status}
        </span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs text-[#aaa]">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {row.participants} joined
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={onLeaderboard}
            className="text-xs text-[#aaa] hover:text-white underline-offset-2 hover:underline"
          >
            Leaderboard
          </button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onToggle}
            className="border-[#333] bg-transparent text-white hover:bg-[#111]"
          >
            {row.enabled ? "Disable" : "Enable"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onDelete}
            className="border-[#333] bg-transparent text-white hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function NewChallengeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [target, setTarget] = useState("12");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState("");

  function applyPreset(p: (typeof PRESETS)[number]) {
    setTitle(p.title);
    setDescription(p.description);
    setTarget(String(p.target_classes));
    setStart(today);
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() + p.duration_days);
    setEnd(endDate.toISOString().slice(0, 10));
  }

  function submit() {
    startTransition(async () => {
      const res = await createChallenge({
        title,
        description: description || null,
        target_classes: Number(target),
        start_date: start,
        end_date: end,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Challenge created");
      setTitle("");
      setDescription("");
      setTarget("12");
      setStart(today);
      setEnd("");
      onOpenChange(false);
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New challenge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-[#888] uppercase tracking-wider">
              Quick presets
            </Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-left rounded-md border border-[#222] bg-black hover:bg-[#111] hover:border-[#333] px-3 py-2"
                >
                  <p className="text-sm text-white">{p.title}</p>
                  <p className="text-[11px] text-[#888]">{p.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ch-title">Title</Label>
            <Input
              id="ch-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="4-Week Challenge"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ch-desc">Description</Label>
            <Textarea
              id="ch-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
              placeholder="What are students working toward?"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="ch-target">Classes</Label>
              <Input
                id="ch-target"
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-start">Start</Label>
              <Input
                id="ch-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ch-end">End</Label>
              <Input
                id="ch-end"
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

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
              disabled={pending || !title || !end}
              className="bg-white text-black hover:bg-white/90"
            >
              {pending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function LeaderboardDialog({
  challenge,
  onOpenChange,
}: {
  challenge: ChallengeAdminRow | null;
  onOpenChange: (v: boolean) => void;
}) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (challenge && rows === null && !loading && !error) {
    setLoading(true);
    startTransition(async () => {
      const r = await getChallengeLeaderboard(challenge.id, 10);
      setLoading(false);
      if (!r.ok) setError(r.error);
      else setRows(r.data);
    });
  }

  return (
    <Dialog
      open={!!challenge}
      onOpenChange={(v) => {
        if (!v) {
          setRows(null);
          setError(null);
        }
        onOpenChange(v);
      }}
    >
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" />
            {challenge?.title} · Top 10
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <p className="text-sm text-[#888] py-6 text-center">Loading…</p>
        )}
        {error && (
          <p className="text-sm text-red-300 py-2">{error}</p>
        )}
        {rows && rows.length === 0 && (
          <p className="text-sm text-[#666] py-6 text-center">
            No participants yet.
          </p>
        )}
        {rows && rows.length > 0 && (
          <ol className="space-y-1.5">
            {rows.map((r, i) => (
              <li
                key={r.student_id}
                className="flex items-center justify-between gap-3 rounded-md border border-[#1f1f1f] bg-black px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "h-6 w-6 grid place-items-center rounded-full text-[11px] font-semibold",
                      i === 0
                        ? "bg-amber-300 text-black"
                        : i === 1
                          ? "bg-[#ddd] text-black"
                          : i === 2
                            ? "bg-[#b87333] text-black"
                            : "bg-[#111] text-[#aaa] border border-[#222]",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm text-white truncate">
                    {r.full_name}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    r.completed ? "text-emerald-300" : "text-[#aaa]",
                  )}
                >
                  {r.classes} / {r.target}
                </span>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
