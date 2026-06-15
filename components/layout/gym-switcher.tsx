"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { switchGym, createGym } from "@/app/(dashboard)/settings/gym/actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type GymOption = {
  id: string;
  name: string;
  slug: string;
};

export function GymSwitcher({
  gyms,
  activeGymId,
}: {
  gyms: GymOption[];
  activeGymId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const activeGym = gyms.find((g) => g.id === activeGymId) ?? gyms[0];

  function onSwitch(gymId: string) {
    if (gymId === activeGymId) return;
    startTransition(async () => {
      const result = await switchGym(gymId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Switched to ${gyms.find((g) => g.id === gymId)?.name ?? "gym"}`);
      router.refresh();
    });
  }

  async function onCreateGym(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const result = await createGym(newName);
    setCreating(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`"${newName.trim()}" created and activated`);
    setShowCreate(false);
    setNewName("");
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Switch gym"
          className={cn(
            "inline-flex items-center gap-2 h-9 pl-2.5 pr-2 rounded-md border border-[#222] bg-[#0a0a0a] hover:bg-[#111] transition-colors text-sm max-w-[180px]",
            pending && "opacity-60",
          )}
        >
          <Building2 className="h-3.5 w-3.5 text-[#888] shrink-0" />
          <span className="truncate text-white text-xs font-medium">
            {activeGym?.name ?? "No Gym"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-[#666] shrink-0" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          className="bg-[#0a0a0a] border-[#1f1f1f] text-white w-64"
        >
          <p className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-[#555] font-normal">
            Your Gyms
          </p>
          <DropdownMenuSeparator className="bg-[#1f1f1f]" />

          {gyms.map((gym) => {
            const active = gym.id === activeGymId;
            return (
              <DropdownMenuItem
                key={gym.id}
                onClick={() => onSwitch(gym.id)}
                className="focus:bg-[#111] focus:text-white py-2.5 cursor-pointer"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="h-5 w-5 grid place-items-center shrink-0">
                    {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", active ? "text-white font-medium" : "text-[#ccc]")}>
                      {gym.name}
                    </p>
                    <p className="text-[10px] text-[#555] font-mono">{gym.slug}</p>
                  </div>
                </div>
              </DropdownMenuItem>
            );
          })}

          <DropdownMenuSeparator className="bg-[#1f1f1f]" />
          <DropdownMenuItem
            onClick={() => setShowCreate(true)}
            className="focus:bg-[#111] focus:text-white py-2.5 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 grid place-items-center shrink-0">
                <Plus className="h-3.5 w-3.5 text-[#666]" />
              </div>
              <span className="text-sm text-[#888]">Create new gym</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Gym</DialogTitle>
          </DialogHeader>
          <form onSubmit={onCreateGym} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="gym-name">Gym name</Label>
              <Input
                id="gym-name"
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
    </>
  );
}
