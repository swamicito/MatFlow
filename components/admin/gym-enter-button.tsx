"use client";

import { useState } from "react";
import { LogIn, Loader2 } from "lucide-react";
import { adminSwitchGym } from "@/app/admin/actions";

export function GymEnterButton({ gymId }: { gymId: string }) {
  const [pending, setPending] = useState(false);

  async function handleEnter() {
    if (pending) return;
    setPending(true);
    const r = await adminSwitchGym(gymId);
    if (r.ok) {
      // Hard navigation so the new gym cookie is picked up immediately
      window.location.href = "/dashboard";
    } else {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleEnter}
      disabled={pending}
      className="h-8 px-3 rounded-lg border border-[#374151] text-xs text-[#9CA3AF] hover:text-white hover:border-[#4B5563] transition-colors inline-flex items-center gap-1.5 disabled:opacity-40 shrink-0"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <LogIn className="h-3 w-3" />
      )}
      Enter
    </button>
  );
}
