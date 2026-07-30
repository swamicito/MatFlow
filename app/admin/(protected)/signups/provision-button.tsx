"use client";

import { useState, useTransition } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { provisionSignupFromSession } from "@/app/admin/actions";

type State = "idle" | "loading" | "done" | "error";

export function ProvisionButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    setState("loading");
    startTransition(async () => {
      const result = await provisionSignupFromSession(sessionId);
      if (result.ok) {
        setState("done");
        setMessage(
          result.data.alreadyProvisioned
            ? "Already provisioned — welcome email re-sent."
            : "Provisioned! Welcome email sent.",
        );
      } else {
        setState("error");
        setMessage(result.error);
      }
    });
  }

  if (state === "done") {
    return (
      <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {message}
      </span>
    );
  }

  if (state === "error") {
    return (
      <span
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium max-w-[260px] truncate"
        title={message ?? undefined}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {message}
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending || state === "loading"}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
    >
      {pending || state === "loading" ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Provisioning…
        </>
      ) : (
        "Provision + Email"
      )}
    </button>
  );
}
