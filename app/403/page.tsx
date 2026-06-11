import Link from "next/link";
import { Lock } from "lucide-react";
import { getCurrentRole } from "@/lib/auth/current-role";
import { ROLE_LABEL, ROLE_DESCRIPTION } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Access denied · MatFlow" };

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const sp = await searchParams;
  const role = await getCurrentRole();
  const target = sp.from && sp.from.startsWith("/") ? sp.from : null;

  return (
    <div className="min-h-screen bg-black text-foreground grid place-items-center px-4">
      <div className="max-w-md w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 grid place-items-center rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 shrink-0">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-[#666]">
              403 · Access denied
            </p>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
              You don&apos;t have permission to view that page.
            </h1>
          </div>
        </div>

        <p className="text-sm text-[#aaa] leading-relaxed">
          You&apos;re currently signed in as{" "}
          <span className="text-white font-medium">{ROLE_LABEL[role]}</span> —{" "}
          {ROLE_DESCRIPTION[role]}
        </p>

        {target && (
          <p className="text-xs text-[#666]">
            Requested route:{" "}
            <code className="font-mono text-[#aaa]">{target}</code>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center h-10 px-4 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90"
          >
            Go to Dashboard
          </Link>
          <p className="text-xs text-[#666]">
            Need access? Ask an Owner to update your role.
          </p>
        </div>
      </div>
    </div>
  );
}
