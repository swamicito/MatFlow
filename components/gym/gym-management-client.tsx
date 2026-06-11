"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { switchGym, createGym, updateGymSettings } from "@/app/(dashboard)/settings/gym/actions";

type GymRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  onboarding_completed: boolean | null;
};

type ActiveGymSettings = {
  id: string;
  free_class_nudge_after: number;
} | null;

export function GymManagementClient({
  gyms,
  activeGymId,
  activeGymSettings,
}: {
  gyms: GymRow[];
  activeGymId: string | null;
  activeGymSettings: ActiveGymSettings;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  function onSwitch(gymId: string) {
    if (gymId === activeGymId) return;
    startTransition(async () => {
      const result = await switchGym(gymId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Switched gym");
      router.refresh();
    });
  }

  async function onCreateGym(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const result = await createGym(newName);
    setCreating(false);
    if (!result.ok) { toast.error(result.error); return; }
    toast.success(`"${newName.trim()}" created and activated`);
    setShowCreate(false);
    setNewName("");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Manage Gyms</h1>
          <p className="text-sm text-[#aaa] mt-1">
            Switch locations or create new gyms. Each gym&apos;s data is fully isolated.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-white text-black hover:bg-white/90 gap-2"
        >
          <Plus className="h-4 w-4" />
          New gym
        </Button>
      </header>

      {gyms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
          <div className="h-12 w-12 grid place-items-center rounded-xl border border-[#222] bg-[#0a0a0a]">
            <Building2 className="h-6 w-6 text-[#555]" />
          </div>
          <p className="text-sm text-[#666]">No gyms found. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {gyms.map((gym) => {
            const active = gym.id === activeGymId;
            return (
              <Card
                key={gym.id}
                className={cn(
                  "bg-[#0a0a0a] border-[#1f1f1f] shadow-none transition-colors",
                  active && "ring-1 ring-white/20 border-[#333]",
                )}
              >
                <CardContent className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        "h-9 w-9 grid place-items-center rounded-md border shrink-0",
                        active ? "border-white/20 bg-white/5 text-white" : "border-[#222] bg-black text-[#555]",
                      )}>
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{gym.name}</p>
                        <p className="text-[11px] text-[#555] font-mono">{gym.slug}</p>
                      </div>
                    </div>
                    {active && (
                      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-400 border border-emerald-500/30 rounded-full px-2 py-0.5 shrink-0">
                        <Check className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-[#555]">
                    Created {new Date(gym.created_at).toLocaleDateString()}
                    {gym.onboarding_completed === false && (
                      <span className="ml-2 text-amber-400/80">· Onboarding incomplete</span>
                    )}
                  </div>

                  {!active && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSwitch(gym.id)}
                      disabled={pending}
                      className="border-[#333] bg-transparent hover:bg-[#111] text-white w-full"
                    >
                      Switch to this gym
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Active-gym settings ── */}
      {activeGymSettings && (
        <GymSettingsSection settings={activeGymSettings} />
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Gym</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreateGym} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="gym-name-mgmt">Gym name</Label>
              <Input
                id="gym-name-mgmt"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Riverside BJJ"
                autoFocus
                className="bg-black border-[#222] text-white placeholder:text-[#555] focus-visible:ring-white/40"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
                className="border-[#333] bg-transparent hover:bg-[#111] text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !newName.trim()}
                className="bg-white text-black hover:bg-white/90"
              >
                {creating ? "Creating…" : "Create gym"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Active-gym settings panel
// ─────────────────────────────────────────────────────────────────────────────

function GymSettingsSection({
  settings,
}: {
  settings: NonNullable<ActiveGymSettings>;
}) {
  const router = useRouter();
  const [saving, startTransition] = useTransition();
  const [nudgeAfter, setNudgeAfter] = useState(
    String(settings.free_class_nudge_after ?? 4),
  );

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const val = parseInt(nudgeAfter, 10);
    if (!Number.isFinite(val) || val < 1 || val > 100) {
      toast.error("Enter a number between 1 and 100.");
      return;
    }
    startTransition(async () => {
      const result = await updateGymSettings({ free_class_nudge_after: val });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Gym settings saved.");
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-[#666]" />
        <h2 className="text-base font-semibold text-white">Active Gym Settings</h2>
      </div>

      <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
        <CardContent className="p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="nudge-after" className="text-sm text-white">
                Free Class Nudge After X Visits
              </Label>
              <p className="text-xs text-[#666] leading-relaxed">
                The{" "}
                <span className="text-[#aaa] font-medium">Free Class Nudge</span>{" "}
                automation fires after a prospect attends this many free classes.
                Adjust to match your intro offer (e.g. 3-class trial → set to 3).
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Input
                  id="nudge-after"
                  type="number"
                  min={1}
                  max={100}
                  value={nudgeAfter}
                  onChange={(e) => setNudgeAfter(e.target.value)}
                  className={cn(
                    "w-24 bg-black border-[#222] text-white text-center",
                    "focus-visible:ring-white/40 [appearance:textfield]",
                    "[&::-webkit-outer-spin-button]:appearance-none",
                    "[&::-webkit-inner-spin-button]:appearance-none",
                  )}
                />
                <span className="text-sm text-[#666]">visits</span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={saving}
                className="bg-white text-black hover:bg-white/90 text-sm"
              >
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
