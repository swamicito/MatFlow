"use client";

import type { PortalAttendanceDay } from "@/app/portal/actions";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function AttendanceHeatmap({ days }: { days: PortalAttendanceDay[] }) {
  // days is 84 items (12 weeks × 7 days), oldest first
  // Group into 12 columns of 7 rows (week = column, day = row)
  const weeks: PortalAttendanceDay[][] = [];
  for (let w = 0; w < 12; w++) {
    weeks.push(days.slice(w * 7, w * 7 + 7));
  }

  // Month labels: find weeks where the first day is in a new month
  const monthLabels: (string | null)[] = weeks.map((week) => {
    const d = new Date(week[0].date);
    // Show month label on the first week of a month
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 7);
    if (prev.getMonth() !== d.getMonth()) {
      return d.toLocaleDateString("en-US", { month: "short" });
    }
    return null;
  });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-fit space-y-1.5">
        {/* Month labels row */}
        <div className="flex gap-1.5 pl-5">
          {weeks.map((_, wi) => (
            <div key={wi} className="w-4 text-[9px] text-[#444] text-center">
              {monthLabels[wi] ?? ""}
            </div>
          ))}
        </div>

        {/* Grid: 7 rows × 12 columns */}
        <div className="flex gap-1">
          {/* Day-of-week labels */}
          <div className="flex flex-col gap-1 pr-1">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="h-4 w-3 text-[9px] text-[#444] flex items-center">
                {i % 2 === 0 ? d : ""}
              </div>
            ))}
          </div>

          {/* Cells */}
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => {
                const intensity =
                  day.count === 0
                    ? 0
                    : day.count === 1
                    ? 1
                    : day.count === 2
                    ? 2
                    : 3;
                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.count} class${day.count !== 1 ? "es" : ""}`}
                    className={cn(
                      "h-4 w-4 rounded-sm",
                      intensity === 0 && "bg-[#111]",
                      intensity === 1 && "bg-[#3a3a3a]",
                      intensity === 2 && "bg-[#777]",
                      intensity === 3 && "bg-white",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 justify-end pt-1">
          <span className="text-[9px] text-[#444]">Less</span>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-3 w-3 rounded-sm",
                i === 0 && "bg-[#111]",
                i === 1 && "bg-[#3a3a3a]",
                i === 2 && "bg-[#777]",
                i === 3 && "bg-white",
              )}
            />
          ))}
          <span className="text-[9px] text-[#444]">More</span>
        </div>
      </div>
    </div>
  );
}
