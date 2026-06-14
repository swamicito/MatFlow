import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Building2, Plus, LayoutDashboard } from "lucide-react";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { logoutPlatformAdmin } from "@/app/admin/login/actions";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const ok = await isPlatformAdmin();
  if (!ok) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* ── Top bar ── */}
      <header className="shrink-0 h-14 border-b border-[#111] flex items-center gap-4 px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#555]" />
          <span className="text-sm font-semibold text-white">Platform Admin</span>
          <span className="mx-2 text-[#222]">·</span>
          <span className="text-xs text-[#444] font-mono tracking-wide">MatFlow</span>
        </div>

        <nav className="flex items-center gap-1 ml-4">
          <Link
            href="/admin/gyms"
            className="inline-flex items-center gap-1.5 text-xs text-[#777] hover:text-white hover:bg-[#0f0f0f] px-3 py-1.5 rounded-lg transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
            All Gyms
          </Link>
          <Link
            href="/admin/gyms/new"
            className="inline-flex items-center gap-1.5 text-xs text-[#777] hover:text-white hover:bg-[#0f0f0f] px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Gym
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-[#555] hover:text-white transition-colors"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Back to Dashboard
          </Link>
          <form action={logoutPlatformAdmin}>
            <button
              type="submit"
              className="text-xs text-[#444] hover:text-red-400 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 px-6 md:px-10 py-8 max-w-5xl w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
