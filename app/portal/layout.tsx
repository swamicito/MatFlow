import type { ReactNode } from "react";
import { PortalNav } from "@/components/portal/portal-nav";

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <PortalNav />
      <main className="px-5 pb-24 pt-6 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}