"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Shield, Trash2, CheckCircle2 } from "lucide-react";
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
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import {
  createPassportChallenge,
  deletePassportChallenge,
  togglePassportChallenge,
  type CreatePassportChallengeInput,
  type PassportChallengeRow,
} from "@/app/(dashboard)/settings/challenges/actions";
import type { ChallengeType } from "@/lib/gamification/challenges";

// ─── Constants ────────────────────────────────────────────────────────────────

const inputCls =
  "bg-black border-[#222] focus-visible:ring-white/40 text-white placeholder:text-[#666]";

const TYPE_OPTIONS: { value: ChallengeType; label: string; hint: string }[] = [
  { value: "class_count",   label: "Class Count",   hint: "Attend N classes during the window" },
  { value: "streak",        label: "Streak",         hint: "Maintain N consecutive check-in days" },
  { value: "points_earned", label: "Points Earned",  hint: "Earn N points during the window" },
];

function goalLabel(type: ChallengeType): string {
  switch (type) {
    case "class_count":   return "Classes to attend";
    case "streak":        return "Consecutive days";
    case "points_earned": return "Points to earn";
  }
}

const PRESETS: (Omit<CreatePassportChallengeInput, "start_date" | "end_date"> & {
  duration_days: number;
})[] = [
  {
    title:          "August Attendance",
    description:    "Attend 8 classes this month.",
    challenge_type: "class_count",
    goal_value:     8,
    points_reward:  100,
    duration_days:  31,
  },
  {
    title:          "Streak Week",
    description:    "Maintain a 7-day check-in streak.",
    challenge_type: "streak",
    goal_value:     7,
    points_reward:  75,
    duration_days:  14,
  },
  {
    title:          "Point Surge",
    description:    "Earn 150 points in this window.",
    challenge_type: "points_earned",
    goal_value:     150,
    points_reward:  50,
    duration_days:  30,
  },
];

function statusBadge(row: PassportChallengeRow) {
  const today = new Date().toISOString().slice(0, 10);
  if (!row.is_active) return { label: "Inactive", cls: "border-[#222] bg-black text-[#888]" };
  if (today < row.start_date) return { label: "Upcoming", cls: "border-blue-500/40 bg-blue-500/10 text-blue-300" };
  if (today > row.end_date)   return { label: "Ended",    cls: "border-[#222] bg-black text-[#888]" };
  return { label: "Active", cls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" };
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function PassportChallengeCard({
  row,
  disabled,
  onToggle,
  onDelete,
}: {
  row: PassportChallengeRow;
  disabled: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { label, cls } = statusBadge(row);
  const typeOpt = TYPE_OPTIONS.find((t) => t.value === row.challenge_type);

  return (
    <div className="rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium">{row.title}</p>
          {row.description && (
            <p className="text-xs text-[#888] mt-0.5">{row.description}</p>
          )}
          <p className="text-[10px] text-[#666] tabular-nums mt-1">
            {row.start_date} → {row.end_date} &middot;{" "}
            {typeOpt?.label ?? row.challenge_type} &middot; goal {row.goal_value} &middot;{" "}
            +{row.points_reward} pts reward
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
            cls,
          )}
        >
          {label}
        </span>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs text-[#666] inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {row.completions} completed
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onToggle}
            className="border-[#333] bg-transparent text-white hover:bg-[#111]"
          >
            {row.is_active ? "Disable" : "Enable"}
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

// ─── Create dialog ────────────────────────────────────────────────────────────

function NewPassportChallengeDialog({
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

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [type,        setType]        = useState<ChallengeType>("class_count");
  const [goal,        setGoal]        = useState("8");
  const [reward,      setReward]      = useState("50");
  const [start,       setStart]       = useState(today);
  const [end,         setEnd]         = useState("");

  function applyPreset(p: (typeof PRESETS)[number]) {
    setTitle(p.title);
    setDescription(p.description ?? "");
    setType(p.challenge_type);
    setGoal(String(p.goal_value));
    setReward(String(p.points_reward));
    setStart(today);
    const endDate = new Date();
    endDate.setUTCDate(endDate.getUTCDate() + p.duration_days);
    setEnd(endDate.toISOString().slice(0, 10));
  }

  function reset() {
    setTitle(""); setDescription(""); setType("class_count");
    setGoal("8"); setReward("50"); setStart(today); setEnd("");
  }

  function submit() {
    startTransition(async () => {
      const res = await createPassportChallenge({
        title,
        description: description || null,
        challenge_type: type,
        goal_value:    Number(goal),
        points_reward: Number(reward),
        start_date:    start,
        end_date:      end,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Passport challenge created");
      reset();
      onOpenChange(false);
      onCreated();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Passport Challenge</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Presets */}
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

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="pc-title">Title</Label>
            <Input
              id="pc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="August Attendance Challenge"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="pc-desc">Description <span className="text-[#555]">(optional)</span></Label>
            <Textarea
              id="pc-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputCls}
              placeholder="What are students working toward?"
            />
          </div>

          {/* Challenge type */}
          <div className="space-y-2">
            <Label>Challenge Type</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "text-left rounded-md border px-3 py-2 transition-colors",
                    type === opt.value
                      ? "border-white/30 bg-white/5"
                      : "border-[#222] bg-black hover:bg-[#111]",
                  )}
                >
                  <p className="text-sm text-white font-medium">{opt.label}</p>
                  <p className="text-[11px] text-[#666]">{opt.hint}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Goal + reward + dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="pc-goal">{goalLabel(type)}</Label>
              <Input
                id="pc-goal"
                type="number"
                min={1}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-reward">Points Reward</Label>
              <Input
                id="pc-reward"
                type="number"
                min={0}
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-start">Start Date</Label>
              <Input
                id="pc-start"
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pc-end">End Date</Label>
              <Input
                id="pc-end"
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
              {pending ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function PassportChallengesAdmin({
  initial,
}: {
  initial: PassportChallengeRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNew, setShowNew] = useState(false);

  function refresh() { router.refresh(); }

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      const r = await togglePassportChallenge(id, isActive);
      if (!r.ok) toast.error(r.error);
      else { toast.success(isActive ? "Challenge enabled" : "Challenge disabled"); refresh(); }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this Passport challenge? Student progress will be lost.")) return;
    startTransition(async () => {
      const r = await deletePassportChallenge(id);
      if (!r.ok) toast.error(r.error);
      else { toast.success("Challenge deleted"); refresh(); }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#666]">
          {initial.length} total &middot;{" "}
          {initial.filter((c) => c.is_active).length} active
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
          icon={Shield}
          title="No Passport challenges yet"
          description="Create time-bound point goals that students automatically progress through when they train."
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
            <PassportChallengeCard
              key={c.id}
              row={c}
              disabled={pending}
              onToggle={() => handleToggle(c.id, !c.is_active)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </div>
      )}

      <NewPassportChallengeDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={refresh}
      />
    </div>
  );
}
