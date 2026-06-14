"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";
import { adminSwitchGym } from "@/app/admin/actions";

export function GymEnterButton({ gymId }: { gymId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleEnter() {
    startTransition(async () => {
      const r = await adminSwitchGym(gymId);
      if (r.ok) router.push("/dashboard");
    });
  }

  return (
    <button
      onClick={handleEnter}
      disabled={pending}
      className="h-8 px-3 rounded-lg border border-[#1f1f1f] text-xs text-[#666] hover:text-white hover:border-[#2a2a2a] transition-colors inline-flex items-center gap-1.5 disabled:opacity-40 shrink-0"
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
