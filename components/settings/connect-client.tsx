"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import {
  startStripeConnect,
  syncConnectStatus,
  createExpressDashboardLink,
  type ConnectState,
} from "@/app/(dashboard)/settings/connect/actions";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  not_connected: { label: "Not connected", color: "text-[#6B7280]" },
  needs_info:    { label: "Needs info",    color: "text-amber-400" },
  restricted:    { label: "Under review",  color: "text-amber-400" },
  ready:         { label: "Ready to charge", color: "text-emerald-400" },
};

export function ConnectClient({
  initialState,
  canManage,
}: {
  initialState: ConnectState | null;
  canManage: boolean;
}) {
  const [state, setState] = useState<ConnectState | null>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const router = useRouter();

  // On return from Stripe onboarding (?return=1), sync status from Stripe.
  // On ?refresh=1 (previous account link expired), restart onboarding automatically.
  useEffect(() => {
    if (searchParams.get("return")) {
      startTransition(async () => {
        const res = await syncConnectStatus();
        if (res.ok) setState(res.data);
        else setError(res.error);
        router.replace("/settings/connect");
      });
    } else if (searchParams.get("refresh")) {
      startTransition(async () => {
        const res = await startStripeConnect();
        if (res.ok) window.location.href = res.data.url;
        else setError(res.error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConnect() {
    setError(null);
    startTransition(async () => {
      const res = await startStripeConnect();
      if (res.ok) {
        window.location.href = res.data.url;
      } else {
        setError(res.error);
      }
    });
  }

  function handleSync() {
    setError(null);
    startTransition(async () => {
      const res = await syncConnectStatus();
      if (res.ok) setState(res.data);
      else setError(res.error);
    });
  }

  function handleDashboard() {
    setError(null);
    startTransition(async () => {
      const res = await createExpressDashboardLink();
      if (res.ok) window.open(res.data.url, "_blank", "noopener");
      else setError(res.error);
    });
  }

  const status = state?.status ?? "not_connected";
  const badge = STATUS_LABEL[status];

  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-6 space-y-5">
      {/* Header row */}
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 grid place-items-center rounded-md border border-[#222] bg-black shrink-0">
          <CreditCard className="h-5 w-5 text-[#ccc]" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-white">Stripe Connect</h2>
            <span className={`text-xs font-medium ${badge.color}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-sm text-[#aaa] leading-relaxed">
            {status === "not_connected" &&
              "Connect your Stripe account to start collecting membership payments directly from your students. Onboarding takes about 5 minutes."}
            {status === "needs_info" &&
              "Your Stripe account was created but onboarding isn't finished. Continue where you left off to start accepting payments."}
            {status === "restricted" &&
              "You've submitted your details — Stripe is reviewing your account. This usually takes a few minutes but can take up to 2 business days."}
            {status === "ready" &&
              "Your Stripe account is connected and ready to accept payments from students."}
          </p>
        </div>
      </div>

      {/* Status detail (connected states) */}
      {state?.accountId && (
        <div className="rounded-lg border border-[#1a1a1a] bg-black px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-[#555] uppercase tracking-wider text-[10px] font-semibold">Account</p>
            <p className="text-[#ccc] font-mono mt-1 truncate" title={state.accountId}>
              {state.accountId.slice(0, 14)}…
            </p>
          </div>
          <div>
            <p className="text-[#555] uppercase tracking-wider text-[10px] font-semibold">Details</p>
            <p className={`mt-1 font-medium ${state.detailsSubmitted ? "text-emerald-400" : "text-amber-400"}`}>
              {state.detailsSubmitted ? "Submitted" : "Pending"}
            </p>
          </div>
          <div>
            <p className="text-[#555] uppercase tracking-wider text-[10px] font-semibold">Charges</p>
            <p className={`mt-1 font-medium ${state.chargesEnabled ? "text-emerald-400" : "text-amber-400"}`}>
              {state.chargesEnabled ? "Enabled" : "Not yet"}
            </p>
          </div>
          <div>
            <p className="text-[#555] uppercase tracking-wider text-[10px] font-semibold">Payouts</p>
            <p className={`mt-1 font-medium ${state.payoutsEnabled ? "text-emerald-400" : "text-amber-400"}`}>
              {state.payoutsEnabled ? "Enabled" : "Not yet"}
            </p>
          </div>
        </div>
      )}

      {/* Success banner after returning from Stripe */}
      {status === "ready" && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-300">
            Payouts land in your bank account daily. Student billing will be enabled next.
          </p>
        </div>
      )}
      {status === "needs_info" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            Stripe needs a bit more information before you can accept payments.
          </p>
        </div>
      )}

      {/* Actions */}
      {canManage && (
        <div className="flex items-center gap-3 flex-wrap">
          {(status === "not_connected" || status === "needs_info") && (
            <button
              onClick={handleConnect}
              disabled={pending}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {status === "not_connected" ? "Connect with Stripe" : "Continue onboarding"}
            </button>
          )}

          {status === "ready" && (
            <button
              onClick={handleDashboard}
              disabled={pending}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Open Stripe Dashboard
            </button>
          )}

          {state?.accountId && status !== "ready" && (
            <button
              onClick={handleSync}
              disabled={pending}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-[#222] text-sm text-[#ccc] hover:text-white hover:border-[#333] transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
              Refresh status
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <p className="text-xs text-[#444] leading-relaxed">
        Payments are processed by Stripe and deposited directly into your bank
        account. MatFlow never touches your money. Your Stripe account belongs
        to you — you can manage payouts, refunds, and tax forms from the Stripe
        dashboard at any time.
      </p>
    </div>
  );
}
