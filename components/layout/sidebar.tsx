"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/nav";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/permissions";
import type { UserRole } from "@/lib/supabase/types";

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => can(role, item.requires));

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <Link href="/dashboard">
          <img src="/logo-full.png" alt="MatFlow" className="h-7 w-auto" />
        </Link>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1">
        {visibleItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                "text-[#aaaaaa] hover:text-white hover:bg-[#111111]",
                active && "bg-[#111111] text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-sidebar-border space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-[#666]">
          Signed in as
        </p>
        <p className="text-xs text-white font-medium">{ROLE_LABEL[role]}</p>
      </div>
    </aside>
  );
}
