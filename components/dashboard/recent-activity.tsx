import Link from "next/link";
import { Activity, CalendarCheck, UserPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Checkin = {
  id: string;
  studentName: string;
  classType: string;
  checkedInAt: string;
};

type RecentLead = {
  id: string;
  name: string;
  source: string;
  createdAt: string;
};

function relTime(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 60) return min <= 1 ? "just now" : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export function RecentActivity({
  checkins,
  recentLeads,
  demoLoaded,
}: {
  checkins: Checkin[];
  recentLeads: RecentLead[];
  demoLoaded: boolean;
}) {
  const hasActivity = checkins.length > 0 || recentLeads.length > 0;

  return (
    <Card className="lg:col-span-2 bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-white flex items-center gap-2">
          <Activity className="h-4 w-4 text-[#555]" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!hasActivity ? (
          <div className="px-6 pb-6 pt-2 text-sm text-[#666] leading-relaxed">
            {demoLoaded ? (
              <>
                Demo data is loaded — explore{" "}
                <Link href="/students" className="text-white hover:underline">Students</Link>,{" "}
                <Link href="/leads" className="text-white hover:underline">Leads</Link>, or{" "}
                <Link href="/checkin" className="text-white hover:underline">Check-In</Link>.
              </>
            ) : (
              <>
                No activity yet.{" "}
                <Link href="/settings/import" className="text-white hover:underline">
                  Import your roster
                </Link>{" "}
                or{" "}
                <Link href="/checkin" className="text-white hover:underline">
                  open Check-In
                </Link>{" "}
                to get started.
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[#111]">
            {checkins.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-6 py-3">
                <div className="h-7 w-7 rounded-full border border-[#222] bg-black grid place-items-center shrink-0">
                  <CalendarCheck className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate">
                    {c.studentName}
                  </span>
                  <span className="text-xs text-[#666] ml-2">{c.classType}</span>
                </div>
                <span className="text-xs text-[#555] tabular-nums shrink-0">
                  {relTime(c.checkedInAt)}
                </span>
              </li>
            ))}
            {recentLeads.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-6 py-3">
                <div className="h-7 w-7 rounded-full border border-[#222] bg-black grid place-items-center shrink-0">
                  <UserPlus className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-white font-medium truncate">
                    {l.name}
                  </span>
                  <span className="text-xs text-[#666] ml-2">New lead · {l.source}</span>
                </div>
                <span className="text-xs text-[#555] tabular-nums shrink-0">
                  {relTime(l.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
