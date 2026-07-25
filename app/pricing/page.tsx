import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { PricingClient } from "@/components/pricing/pricing-client";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for BJJ gym management. Start free for 30 days — no credit card required. Plans from $69/mo.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 pb-32 pt-32 sm:px-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-14 text-center">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-xs text-[#6B7280] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to home
          </Link>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#9CA3AF]">
              30-day free trial
            </span>
          </div>

          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Simple, honest pricing.
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-base text-[#6B7280]">
            No hidden fees. No credit card required to begin. Start your 30-day
            free trial today — if you don&apos;t add a payment method, your
            subscription cancels automatically. No surprise charges, ever.
          </p>

          {/* Trust bar */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-[#4B5563]">
            <span>✓ No credit card required</span>
            <span>✓ Auto-cancels if you don&apos;t continue</span>
            <span>✓ 30-day free trial on every plan</span>
            <span>✓ Annual plans save 20% · onboarding waived</span>
          </div>
        </div>

        {/* ── Interactive pricing section ──────────────────────────────────── */}
        <PricingClient />
      </main>
    </div>
  );
}
