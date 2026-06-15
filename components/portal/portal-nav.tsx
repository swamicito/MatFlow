"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, FileSignature, MessageSquare, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Home", icon: Home },
  { href: "/portal/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/portal/waivers", label: "Waivers", icon: FileSignature },
  { href: "/portal/messages", label: "Messages", icon: MessageSquare },
  { href: "/portal/membership", label: "Billing", icon: CreditCard },
];

export function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#222] bg-black/95 backdrop-blur-lg">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/portal"
            ? pathname === "/portal"
            : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-95",
                active ? "text-white" : "text-[#9CA3AF]"
              )}
            >
              <Icon 
                className={cn(
                  "h-5 w-5 mb-0.5 transition-all",
                  active && "scale-110 text-white"
                )} 
              />
              <span className="text-[9px] font-medium tracking-wide">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}