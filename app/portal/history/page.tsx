import { redirect } from "next/navigation";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getPortalDashboard } from "../actions";
import { Dumbbell, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

const CLASS_TYPE_COLORS: Record<string, string> = {
  gi: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  "no-gi": "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "no gi": "border-amber-500/30 bg-amber-500/10 text-amber-300",
  fundamentals: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  competition: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  open: "border-[#333] bg-[#111] text-[#888]",
};

function classTypeStyle(type: string | null): string {
  if (!type) return "border-[#333] bg-[#111] text-[#888]";
  const key = type.toLowerCase();
  return CLASS_TYPE_COLORS[key] ?? "border-[#333] bg-[#111] text-[#888]";
}

function groupByMonth(checkins: { id: string; class_date: string; class_type: string | null; checked_in_at: string }[]) {
  const groups: Map<string, typeof checkins> = new Map();
  for (const c of checkins) {
    const d = new Date(c.checked_in_at);
    const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }
  return [...groups.entries()];
}

export default async function HistoryPage() {
  const identity = await getCurrentStudentIdentity();
  if (!identity) redirect("/login");

  const data = await getPortalDashboard(identity.studentId);
  if (!data) redirect("/login?error=no_student");

  const { recentCheckins, stats } = data;
  const grouped = groupByMonth(recentCheckins);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <span className="text-sm text-[#555]">{stats.totalClasses} total</span>
      </div>

      {recentCheckins.length === 0 ? (
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] py-16 flex flex-col items-center gap-4">
          <div className="h-16 w-16 grid place-items-center rounded-2xl border border-[#222] bg-black">
            <Calendar className="h-7 w-7 text-[#444]" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-white">No check-ins yet</p>
            <p className="text-xs text-[#555]">Your class history will appear here after your first check-in.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([month, items]) => (
            <section key={month} className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-[#555] uppercase tracking-widest">{month}</h2>
                <span className="text-xs text-[#444]">{items.length} class{items.length !== 1 ? "es" : ""}</span>
              </div>
              <div className="divide-y divide-[#111] rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden">
                {items.map((c) => {
                  const d = new Date(c.checked_in_at);
                  return (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="h-9 w-9 grid place-items-center rounded-lg border border-[#1f1f1f] bg-black shrink-0">
                        <Dumbbell className="h-4 w-4 text-[#444]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">
                          {c.class_type ?? "Class"}
                        </p>
                        <p className="text-xs text-[#555]">
                          {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {" · "}
                          {d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      {c.class_type && (
                        <span className={`text-[10px] border rounded-full px-2 py-0.5 ${classTypeStyle(c.class_type)}`}>
                          {c.class_type}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <p className="text-center text-xs text-[#444] pb-4">
            Showing last {recentCheckins.length} check-ins
          </p>
        </div>
      )}
    </div>
  );
}
