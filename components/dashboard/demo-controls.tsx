"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearDemoData,
  loadDemoData,
  type DemoCounts,
} from "@/app/(dashboard)/dashboard/demo-actions";
import { cn } from "@/lib/utils";

export function DemoControls({
  loaded,
  studentCount,
}: {
  loaded: boolean;
  studentCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resetOpen, setResetOpen] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);

  function summarize(c: DemoCounts) {
    const bits: string[] = [];
    if (c.students) bits.push(`${c.students} students`);
    if (c.families) bits.push(`${c.families} families`);
    if (c.memberships) bits.push(`${c.memberships} memberships`);
    if (c.leads) bits.push(`${c.leads} leads`);
    if (c.plans) bits.push(`${c.plans} plans`);
    return bits.join(" · ");
  }

  function onLoad() {
    startTransition(async () => {
      const result = await loadDemoData();
      if (!result.ok) {
        toast.error("Couldn't load demo data", { description: result.error });
        return;
      }
      toast.success("Demo data loaded", {
        description: summarize(result.counts),
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      router.refresh();
    });
  }

  function onClear() {
    setResetOpen(false);
    startTransition(async () => {
      const result = await clearDemoData();
      if (!result.ok) {
        toast.error("Couldn't clear demo data", { description: result.error });
        return;
      }
      toast.success("Demo data cleared", {
        description: summarize(result.counts) || "Workspace reset.",
        icon: <Trash2 className="h-4 w-4" />,
      });
      router.refresh();
    });
  }

  function onReload() {
    setReloadOpen(false);
    startTransition(async () => {
      const cleared = await clearDemoData();
      if (!cleared.ok) {
        toast.error("Reset failed", { description: cleared.error });
        return;
      }
      const loaded = await loadDemoData();
      if (!loaded.ok) {
        toast.error("Reload failed", { description: loaded.error });
        return;
      }
      toast.success("Demo data reloaded", {
        description: summarize(loaded.counts),
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      router.refresh();
    });
  }

  if (!loaded) {
    return (
      <Button
        onClick={onLoad}
        disabled={pending}
        className="bg-white text-black hover:bg-white/90 h-10 px-4"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Loading demo data…
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4 mr-2" />
            Load Demo Data
          </>
        )}
      </Button>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2.5 py-0.5 text-[11px] uppercase tracking-widest",
          )}
        >
          <Sparkles className="h-3 w-3" />
          Demo mode · {studentCount} students
        </span>
        <Button
          variant="outline"
          onClick={() => setReloadOpen(true)}
          disabled={pending}
          className="h-9 border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Reload
        </Button>
        <Button
          variant="outline"
          onClick={() => setResetOpen(true)}
          disabled={pending}
          className="h-9 border-[#222] bg-transparent text-[#ccc] hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear
        </Button>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Clear all demo data?"
        description="This deletes every record tagged [DEMO DATA] — students, families, leads, demo plans, and any cascaded belt progress / memberships. Real data created outside the demo is preserved."
        confirmLabel="Yes, clear it"
        confirmTone="danger"
        onConfirm={onClear}
        pending={pending}
      />

      <ConfirmDialog
        open={reloadOpen}
        onOpenChange={setReloadOpen}
        title="Reset and reload demo data?"
        description="Wipes existing demo records, then re-seeds 16 students, 4 families, 7 leads, and 4 plans."
        confirmLabel="Reset & reload"
        confirmTone="primary"
        onConfirm={onReload}
        pending={pending}
      />
    </>
  );
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmTone,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone: "primary" | "danger";
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription className="text-[#aaa]">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
            className="text-[#aaa] hover:text-white hover:bg-[#111]"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              confirmTone === "danger"
                ? "bg-red-500/20 border border-red-500/40 text-red-200 hover:bg-red-500/30"
                : "bg-white text-black hover:bg-white/90",
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
