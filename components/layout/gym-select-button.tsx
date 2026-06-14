"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { switchGym } from "@/app/(dashboard)/settings/gym/actions";

export function GymSelectButton({
  gym,
}: {
  gym: { id: string; name: string; slug: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSelect() {
    startTransition(async () => {
      const result = await switchGym(gym.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleSelect}
      disabled={pending}
      className={cn(
        "w-full flex items-center justify-between p-4 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] hover:bg-[#111] hover:border-[#2a2a2a] transition-colors text-left",
        pending && "opacity-50 cursor-not-allowed",
      )}
    >
      <div>
        <p className="text-sm font-medium text-white">{gym.name}</p>
        <p className="text-xs text-[#555] font-mono mt-0.5">{gym.slug}</p>
      </div>
      <span className="text-xs text-[#555]">
        {pending ? "Selecting…" : "Select →"}
      </span>
    </button>
  );
}
