"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";

export default function SignupConfirmedError() {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8 text-center">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-amber-500/10 border-2 border-amber-500/30 grid place-items-center">
            <AlertCircle className="h-10 w-10 text-amber-400" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">
            Something went wrong
          </h1>
          <p className="text-[#9CA3AF] leading-relaxed">
            We couldn&apos;t load your confirmation page, but your signup was
            received. Check your inbox for a login link — or contact us and
            we&apos;ll sort it out immediately.
          </p>
        </div>

        <a
          href="mailto:support@mat-flow.net"
          className="inline-block px-6 py-3 rounded-xl bg-white text-black text-sm font-semibold hover:bg-gray-100 transition-colors"
        >
          Contact support@mat-flow.net
        </a>

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
