import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  delta?: string;
  trend?: "up" | "down";
  icon: LucideIcon;
};

export function StatCard({ label, value, delta, trend = "up", icon: Icon }: StatCardProps) {
  return (
    <Card className="bg-[#0a0a0a] border-[#1f1f1f] rounded-lg shadow-none">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-[#aaaaaa]">
              {label}
            </p>
            <p className="text-3xl font-semibold tracking-tight text-white">
              {value}
            </p>
            {delta && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-xs",
                  trend === "up" ? "text-white" : "text-[#aaaaaa]",
                )}
              >
                {trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                <span>{delta}</span>
                <span className="text-[#666]">vs last month</span>
              </div>
            )}
          </div>
          <div className="h-10 w-10 grid place-items-center rounded-md border border-[#222] bg-black">
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
