"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Bell, Check, ChevronDown, Search, ShieldCheck, Menu, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABEL, ROLE_DESCRIPTION, can } from "@/lib/permissions";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { GymSwitcher, type GymOption } from "@/components/layout/gym-switcher";
import { navItems } from "@/lib/nav";

const ALL_ROLES: UserRole[] = ["owner", "admin", "instructor", "front_desk"];

const ROLE_BADGE: Record<UserRole, string> = {
  owner: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  admin: "border-sky-500/50 bg-sky-500/10 text-sky-300",
  instructor: "border-amber-500/50 bg-amber-500/10 text-amber-200",
  front_desk: "border-[#333] bg-[#0a0a0a] text-[#ccc]",
};

export function Topbar({
  role,
  gyms,
  activeGymId,
}: {
  role: UserRole;
  gyms: GymOption[];
  activeGymId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");

  const visibleItems = navItems.filter((item) => can(role, item.requires));

  function handleSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && search.trim()) {
      router.push(`/students?search=${encodeURIComponent(search.trim())}`);
      setSearch("");
    }
  }

  function switchRole(next: UserRole) {
    if (next === role) return;
    startTransition(async () => {
      const res = await fetch("/api/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role: next }),
      });
      if (!res.ok) {
        toast.error("Couldn't switch role");
        return;
      }
      toast.success(`Switched to ${ROLE_LABEL[next]}`);
      router.refresh();
    });
  }

  return (
    <>
    <header className="h-16 flex items-center justify-between gap-3 border-b border-border px-4 md:px-6 bg-background">
      {/* Left: hamburger (mobile) + search (desktop) */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden h-9 w-9 grid place-items-center rounded-xl border border-[#222] text-[#888] hover:text-white hover:bg-[#111] transition-colors shrink-0"
          aria-label="Open navigation"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students, leads, classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKey}
            className="pl-9 bg-[#0a0a0a] border-[#222222] text-white placeholder:text-[#666] focus-visible:ring-white/40"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        <GymSwitcher gyms={gyms} activeGymId={activeGymId} />

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Notifications"
            className="h-9 w-9 grid place-items-center rounded-md border border-[#222] hover:bg-[#111] transition-colors"
          >
            <Bell className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-[#0a0a0a] border-[#1f1f1f] text-white w-72">
            <p className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-[#555] font-normal">
              Notifications
            </p>
            <DropdownMenuSeparator className="bg-[#1f1f1f]" />
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Bell className="h-5 w-5 text-[#333]" />
              <p className="text-sm text-[#555]">No new notifications</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Switch role"
            className={cn(
              "inline-flex items-center gap-2 h-9 pl-1 pr-3 rounded-md border border-[#222] bg-[#0a0a0a] hover:bg-[#111] transition-colors text-sm",
              pending && "opacity-60",
            )}
          >
            <Avatar className="h-7 w-7 border border-[#222]">
              <AvatarFallback className="bg-[#111] text-white text-xs">
                AP
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                ROLE_BADGE[role],
              )}
            >
              <ShieldCheck className="h-3 w-3" />
              {ROLE_LABEL[role]}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#888]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[#0a0a0a] border-[#1f1f1f] text-white w-80"
          >
            <p className="px-2 py-1.5 text-[10px] uppercase tracking-widest text-[#666] font-normal">
              View as · demo role switcher
            </p>
            <DropdownMenuSeparator className="bg-[#1f1f1f]" />
            {ALL_ROLES.map((r) => {
              const active = r === role;
              return (
                <DropdownMenuItem
                  key={r}
                  onClick={() => switchRole(r)}
                  className="focus:bg-[#111] focus:text-white py-2.5 cursor-pointer"
                >
                  <div className="flex items-start gap-2 w-full">
                    <div className="h-5 w-5 grid place-items-center mt-0.5 shrink-0">
                      {active && (
                        <Check className="h-4 w-4 text-emerald-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">
                        {ROLE_LABEL[r]}
                      </p>
                      <p className="text-xs text-[#888] leading-snug mt-0.5">
                        {ROLE_DESCRIPTION[r]}
                      </p>
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>

    {/* ── Mobile slide-in drawer ── */}
    {drawerOpen && (
      <div className="fixed inset-0 z-50 md:hidden">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
        {/* Panel */}
        <div className="absolute left-0 top-0 bottom-0 w-72 bg-[#050505] border-r border-[#1f1f1f] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-[#1a1a1a] shrink-0">
            <Link href="/dashboard" onClick={() => setDrawerOpen(false)}>
              <img src="/logo-full.png" alt="MatFlow" className="h-8 w-auto" />
            </Link>
            <button
              onClick={() => setDrawerOpen(false)}
              className="h-8 w-8 grid place-items-center rounded-xl text-[#555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                    active
                      ? "bg-white/10 text-white font-medium"
                      : "text-[#999] hover:text-white hover:bg-[#111]",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Role footer */}
          <div className="px-5 py-4 border-t border-[#1a1a1a] shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-[#555] mb-1">
              Signed in as
            </p>
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              ROLE_BADGE[role],
            )}>
              <ShieldCheck className="h-3 w-3" />
              {ROLE_LABEL[role]}
            </span>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
