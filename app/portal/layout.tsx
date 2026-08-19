import type { ReactNode } from "react";
import { PortalNav } from "@/components/portal/portal-nav";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { awardDailyLoginBonus } from "@/lib/gamification/passport";
import { createAdminClient } from "@/lib/supabase/admin";

// Awards the daily +5 pts bonus silently on every portal page visit.
// awardDailyLoginBonus is wrapped in React cache() so this call runs the
// actual DB work exactly once per request — the Passport page's own call
// gets the same cached return value (true/false) at no extra DB cost.
async function getUnreadMessageCount(studentId: string): Promise<number> {
  try {
    const admin = createAdminClient() as any;
    const { data: parts } = await admin
      .from("conversation_participants")
      .select("conversation_id")
      .eq("student_id", studentId);
    const convIds = (parts ?? []).map((p: any) => p.conversation_id);
    if (convIds.length === 0) return 0;
    const { count } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("sender_type", "owner")
      .is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

// Awards the daily +5 pts bonus silently on every portal page visit.
// awardDailyLoginBonus is wrapped in React cache() so this call runs the
// actual DB work exactly once per request — the Passport page's own call
// gets the same cached return value (true/false) at no extra DB cost.
export default async function PortalLayout({ children }: { children: ReactNode }) {
  let unreadMessages = 0;
  try {
    const identity = await getCurrentStudentIdentity();
    if (identity?.gymId) {
      await awardDailyLoginBonus(identity.authUserId, identity.gymId);
    }
    if (identity?.studentId) {
      unreadMessages = await getUnreadMessageCount(identity.studentId);
    }
  } catch { /* non-fatal — never break a page load for a bonus or badge */ }

  return (
    <div className="min-h-screen bg-black text-white">
      <PortalNav unreadMessages={unreadMessages} />
      <main className="px-5 pb-24 pt-6 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}