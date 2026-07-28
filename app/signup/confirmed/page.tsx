import Link from "next/link";
import { CheckCircle2, Mail, Zap, ArrowRight } from "lucide-react";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const metadata = { title: "You're on the list · MatFlow" };

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  growth: "Growth",
};

const INTERVAL_LABEL: Record<string, string> = {
  monthly: "monthly",
  annual: "annual",
};

async function getSessionData(sessionId: string) {
  try {
    const stripe = getStripe();
    if (!stripe) return null;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return session;
  } catch {
    return null;
  }
}

export default async function SignupConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  const session = session_id ? await getSessionData(session_id) : null;

  const gymName    = session?.metadata?.gym_name    ?? null;
  const ownerName  = session?.metadata?.owner_name  ?? null;
  const ownerEmail = session?.metadata?.owner_email ?? session?.customer_email ?? null;
  const plan       = session?.metadata?.matflow_plan     ?? null;
  const interval   = session?.metadata?.matflow_interval ?? null;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">

        {/* Success icon */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 grid place-items-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          </div>
        </div>

        {/* Headline */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-white">
            You&apos;re on the list!
          </h1>
          <p className="text-[#9CA3AF] leading-relaxed">
            {gymName ? (
              <>
                <span className="font-semibold text-white">{gymName}</span> is
                being provisioned automatically. Check your inbox — your login
                link is on its way.
              </>
            ) : (
              "Your MatFlow workspace is being provisioned. Check your inbox — your login link is on its way."
            )}
          </p>
        </div>

        {/* Details card */}
        <div className="rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] divide-y divide-[#1a1a1a]">

          {ownerEmail && (
            <div className="flex items-center gap-4 px-5 py-4">
              <div className="h-8 w-8 rounded-lg border border-[#1f1f1f] bg-[#111] grid place-items-center shrink-0">
                <Mail className="h-3.5 w-3.5 text-[#6B7280]" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-widest text-[#555]">
                  Login link coming to
                </p>
                <p className="text-sm font-semibold text-white">{ownerEmail}</p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 px-5 py-4">
            <div className="h-8 w-8 rounded-lg border border-[#1f1f1f] bg-[#111] grid place-items-center shrink-0">
              <Zap className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-widest text-[#555]">
                Provisioning
              </p>
              <p className="text-sm font-semibold text-white">
                Automatic — login link sent within minutes
              </p>
            </div>
          </div>

          {plan && (
            <div className="px-5 py-4">
              <p className="text-[11px] font-medium uppercase tracking-widest text-[#555] mb-1">
                Plan selected
              </p>
              <p className="text-sm font-semibold text-white">
                {PLAN_LABEL[plan] ?? plan}
                {interval ? ` · ${INTERVAL_LABEL[interval] ?? interval}` : ""}
                {" "}· 30-day free trial
              </p>
            </div>
          )}
        </div>

        {/* What happens next */}
        <div className="rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] p-6 space-y-4">
          <h2 className="text-sm font-semibold text-white">What happens next</h2>
          <ol className="space-y-3">
            {[
              ownerEmail
                ? `A login link was sent to ${ownerEmail} — check your inbox (and spam folder).`
                : "A login link was sent to the email you provided — check your inbox.",
              "Click the link — no password needed. You land directly in MatFlow.",
              "Walk through a 2-minute setup wizard to configure your gym details.",
              "Embed your schedule on your website, import students, and go live.",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-[11px] font-bold text-emerald-400 flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-sm text-[#9CA3AF] leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Questions */}
        <p className="text-center text-sm text-[#555]">
          Questions?{" "}
          <a
            href="mailto:support@mat-flow.net"
            className="text-emerald-400 hover:underline"
          >
            support@mat-flow.net
          </a>
        </p>

        {/* Back link */}
        <div className="flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs text-[#555] hover:text-white transition-colors"
          >
            <ArrowRight className="h-3 w-3 rotate-180" />
            Back to mat-flow.net
          </Link>
        </div>

      </div>
    </div>
  );
}
