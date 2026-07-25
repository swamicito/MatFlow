import type { ReactNode } from "react";
import { PortalNav } from "@/components/portal/portal-nav";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { awardDailyLoginBonus } from "@/lib/gamification/passport";

// Awards the daily +5 pts bonus silently on every portal page visit.
// awardDailyLoginBonus is wrapped in React cache() so this call runs the
// actual DB work exactly once per request — the Passport page's own call
// gets the same cached return value (true/false) at no extra DB cost.
export default async function PortalLayout({ children }: { children: ReactNode }) {
  try {
    const identity = await getCurrentStudentIdentity();
    if (identity?.gymId) {
      await awardDailyLoginBonus(identity.authUserId, identity.gymId);
    }
  } catch { /* non-fatal — never break a page load for a bonus */ }

  return (
    <div className="min-h-screen bg-black text-white">
      <PortalNav />
      <main className="px-5 pb-24 pt-6 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}