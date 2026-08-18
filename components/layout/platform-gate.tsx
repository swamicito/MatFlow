"use client";

import { useTransition } from "react";
import { CreditCard, Lock, Mail, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createPlatformBillingPortal } from "@/app/(dashboard)/platform-billing-actions";

function openPortal(startTransition: React.TransitionStartFunction, setPending: (b: boolean) => void) {
  setPending(true);
  startTransition(async () => {
    const r = await createPlatformBillingPortal();
    if (!r.ok) {
      toast.error("Couldn't open billing portal", { description: r.error });
      setPending(false);
      return;
    }
    window.location.href = r.url;
  });
}

/** Amber banner shown during the past_due grace window. */
export function GraceBanner({ daysLeft }: { daysLeft: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 flex items-center gap-4 flex-wrap">
      <TriangleAlert className="h-4 w-4 text-amber-300 shrink-0" />
      <p className="flex-1 min-w-[240px] text-sm text-amber-200">
        Your MatFlow payment failed. You have{" "}
        <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> to update your
        payment method before the dashboard is locked.
      </p>
      <Button
        size="sm"
        disabled={pending}
        onClick={() => openPortal(startTransition, () => {})}
        className="bg-amber-300 text-black hover:bg-amber-200 h-8 text-xs font-semibold"
      >
        <CreditCard className="h-3.5 w-3.5 mr-1.5" />
        {pending ? "Opening…" : "Update payment"}
      </Button>
    </div>
  );
}

/** Full-screen replacement for the dashboard when the gym is locked. */
export function LockedScreen({ status }: { status: "past_due" | "canceled" | "unpaid" }) {
  const [pending, startTransition] = useTransition();

  const headline =
    status === "past_due"
      ? "Payment past due"
      : status === "canceled"
        ? "Subscription canceled"
        : "Subscription unpaid";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] grid place-items-center mx-auto">
          <Lock className="h-7 w-7 text-[#666]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-white">{headline}</h1>
          <p className="text-sm text-[#888] leading-relaxed">
            This gym&apos;s MatFlow subscription is {status.replace("_", " ")}, so the
            staff dashboard is paused. Your data is safe — update billing to
            restore access immediately.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button
            disabled={pending}
            onClick={() => openPortal(startTransition, () => {})}
            className="bg-white text-black hover:bg-white/90"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            {pending ? "Opening billing portal…" : "Update payment method"}
          </Button>
          <a
            href="mailto:support@mat-flow.net"
            className="inline-flex items-center justify-center gap-2 text-xs text-[#666] hover:text-white transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Contact support
          </a>
        </div>
        <p className="text-[11px] text-[#444]">
          The student portal is not affected by this lock.
        </p>
      </div>
    </div>
  );
}
