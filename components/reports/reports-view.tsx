"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Award,
  CalendarCheck,
  Download,
  DollarSign,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BELT_BADGE, BELT_LABEL } from "@/lib/students";
import { formatMoney } from "@/lib/billing";
import { toCsv } from "@/lib/import/csv";
import {
  RANGE_LABEL,
  RANGE_OPTIONS,
  type AtRiskRow,
  type BeltBucket,
  type LeadSourceBucket,
  type RangeKey,
  type RevenuePlanBucket,
} from "@/lib/reports";
import { cn } from "@/lib/utils";

export type ReportsStats = {
  retention30: number;
  retention30Cohort: number;
  retention90: number;
  retention90Cohort: number;
  atRiskCount: number;
  mrrCents: number;
  avgAttendance: number;
  avgAttendanceWindowDays: number;
  totalCheckIns: number;
  activeStudents: number;
};

type Props = {
  range: RangeKey;
  stats: ReportsStats;
  buckets: BeltBucket[];
  sources: LeadSourceBucket[];
  planRevenue: RevenuePlanBucket[];
  atRisk: AtRiskRow[];
};

export function ReportsView({
  range,
  stats,
  buckets,
  sources,
  planRevenue,
  atRisk,
}: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  function setRange(r: RangeKey) {
    const next = new URLSearchParams(sp.toString());
    next.set("range", r);
    router.push(`/reports?${next.toString()}`);
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Reports
          </h1>
          <p className="text-sm text-[#aaa] mt-1">
            Retention, revenue, attendance, and lead-source performance.
          </p>
        </div>
        <RangeSelector value={range} onChange={setRange} />
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Stat
          label="Retention · 30d"
          value={fmtPct(stats.retention30)}
          sub={`${stats.retention30Cohort} students in cohort`}
          icon={TrendingUp}
        />
        <Stat
          label="At-Risk Students"
          value={String(stats.atRiskCount)}
          sub="No check-in in 14+ days"
          icon={AlertTriangle}
          tone={stats.atRiskCount > 0 ? "warn" : "ok"}
        />
        <Stat
          label="Active Revenue (MRR)"
          value={formatMoney(stats.mrrCents)}
          sub="Across all earning memberships"
          icon={DollarSign}
        />
        <Stat
          label={`Avg Attendance · ${stats.avgAttendanceWindowDays}d`}
          value={stats.avgAttendance.toFixed(1)}
          sub={`${stats.totalCheckIns} check-ins · ${stats.activeStudents} active`}
          icon={CalendarCheck}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Belt Distribution" icon={Award}>
          <BeltDistribution buckets={buckets} />
        </Panel>

        <Panel title="Retention · 90d">
          <div className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-semibold tracking-tight text-white tabular-nums">
                {fmtPct(stats.retention90)}
              </span>
              <span className="text-xs uppercase tracking-widest text-[#666]">
                {stats.retention90Cohort} students in cohort
              </span>
            </div>
            <ProgressBar value={stats.retention90} />
            <p className="text-xs text-[#888] leading-relaxed">
              Of students who joined more than 90 days ago, the share that
              are still <span className="text-white">not cancelled</span>.
              First 90 days of any member are excluded.
            </p>
          </div>
        </Panel>
      </section>

      <Panel
        title="Lead Source Performance"
        icon={TrendingUp}
        meta={`${RANGE_LABEL[range]}`}
        action={
          sources.length > 0 ? (
            <CsvButton
              filename="lead-sources.csv"
              build={() =>
                toCsv(
                  ["source", "total", "converted", "conversion_pct"],
                  sources.map((s) => ({
                    source: s.source,
                    total: s.total,
                    converted: s.converted,
                    conversion_pct: (s.conversion * 100).toFixed(1),
                  })),
                )
              }
            />
          ) : null
        }
      >
        {sources.length === 0 ? (
          <Empty>No leads in this range yet.</Empty>
        ) : (
          <LeadSourceTable rows={sources} />
        )}
      </Panel>

      <Panel title="Revenue by Plan" icon={DollarSign}>
        {planRevenue.length === 0 ? (
          <Empty>No active memberships yet.</Empty>
        ) : (
          <RevenueByPlanTable rows={planRevenue} totalCents={stats.mrrCents} />
        )}
      </Panel>

      <Panel
        title="At-Risk Students"
        icon={AlertTriangle}
        meta={`${atRisk.length} student${atRisk.length === 1 ? "" : "s"}`}
        action={
          atRisk.length > 0 ? (
            <CsvButton
              filename="at-risk.csv"
              build={() =>
                toCsv(
                  ["name", "belt", "status", "last_check_in", "days_since"],
                  atRisk.map((r) => ({
                    name: r.full_name,
                    belt: r.belt_rank,
                    status: r.status,
                    last_check_in: r.last_check_in ?? "",
                    days_since: r.days_since ?? "",
                  })),
                )
              }
            />
          ) : null
        }
      >
        {atRisk.length === 0 ? (
          <Empty>
            No at-risk students — great retention!{" "}
            <span className="text-[#666]">
              (No active member missed 14+ consecutive days.)
            </span>
          </Empty>
        ) : (
          <AtRiskTable rows={atRisk} />
        )}
      </Panel>
    </div>
  );
}

// ─────────────────── Range selector ───────────────────

function RangeSelector({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-[#222] bg-black p-0.5">
      {RANGE_OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-3 h-8 rounded text-xs uppercase tracking-widest transition-colors",
              active
                ? "bg-white text-black"
                : "text-[#888] hover:text-white hover:bg-[#111]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────── Building blocks ───────────────────

function Stat({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "warn" | "ok";
}) {
  const toneCls =
    tone === "warn"
      ? "border-amber-500/40"
      : tone === "ok"
        ? "border-emerald-500/30"
        : "border-[#1f1f1f]";
  return (
    <Card className={cn("bg-[#0a0a0a] shadow-none", toneCls)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[#888]">
              {label}
            </p>
            <p className="text-3xl font-semibold tracking-tight text-white tabular-nums mt-1">
              {value}
            </p>
            {sub && <p className="text-xs text-[#666] mt-1">{sub}</p>}
          </div>
          <div className="h-9 w-9 grid place-items-center rounded-md border border-[#222] bg-black text-[#ccc]">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Panel({
  title,
  icon: Icon,
  meta,
  action,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  meta?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
      <CardContent className="p-0">
        <div className="px-6 pt-5 pb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-[#888]" />}
            <h2 className="text-base font-medium text-white">{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            {meta && (
              <span className="text-xs uppercase tracking-widest text-[#666]">
                {meta}
              </span>
            )}
            {action}
          </div>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </CardContent>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-[#222] bg-black px-4 py-8 text-center text-sm text-[#aaa]">
      {children}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 w-full rounded-full bg-[#161616] overflow-hidden">
      <div
        className="h-full bg-white transition-all"
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

// ─────────────────── Belt distribution ───────────────────

function BeltDistribution({ buckets }: { buckets: BeltBucket[] }) {
  const visible = buckets.filter((b) => b.count > 0);
  if (visible.length === 0) {
    return <Empty>No students yet — load demo data or import a roster.</Empty>;
  }
  return (
    <ul className="space-y-3">
      {visible.map((b) => (
        <li key={b.belt} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                BELT_BADGE[b.belt],
              )}
            >
              {BELT_LABEL[b.belt]}
            </span>
            <span className="text-xs text-[#aaa] tabular-nums">
              {b.count} ({(b.pct * 100).toFixed(0)}%)
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#161616] overflow-hidden">
            <div
              className="h-full bg-white/80"
              style={{ width: `${b.pct * 100}%` }}
            />
          </div>
          <StripeBreakdown buckets={b.stripes} total={b.count} />
        </li>
      ))}
    </ul>
  );
}

function StripeBreakdown({
  buckets,
  total,
}: {
  buckets: Partial<Record<0 | 1 | 2 | 3 | 4, number>>;
  total: number;
}) {
  if (total === 0) return null;
  const entries = ([0, 1, 2, 3, 4] as const)
    .map((s) => [s, buckets[s] ?? 0] as const)
    .filter(([, n]) => n > 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex gap-2 text-[10px] uppercase tracking-widest text-[#666]">
      {entries.map(([stripes, n]) => (
        <span key={stripes}>
          {n}× {stripes} {stripes === 1 ? "stripe" : "stripes"}
        </span>
      ))}
    </div>
  );
}

// ─────────────────── Lead source table ───────────────────

function LeadSourceTable({ rows }: { rows: LeadSourceBucket[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow className="border-[#1f1f1f] hover:bg-transparent">
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">
            Source
          </TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">
            Volume
          </TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            Leads
          </TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            Converted
          </TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            Conversion
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.source}
            className="border-[#1f1f1f] hover:bg-[#0a0a0a]"
          >
            <TableCell className="font-medium text-white">
              {r.source}
            </TableCell>
            <TableCell className="w-1/2">
              <div className="h-1.5 rounded-full bg-[#161616] overflow-hidden">
                <div
                  className="h-full bg-white/80"
                  style={{ width: `${(r.total / max) * 100}%` }}
                />
              </div>
            </TableCell>
            <TableCell className="text-right text-[#ccc] tabular-nums">
              {r.total}
            </TableCell>
            <TableCell className="text-right text-[#ccc] tabular-nums">
              {r.converted}
            </TableCell>
            <TableCell className="text-right text-white tabular-nums">
              {(r.conversion * 100).toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}

// ─────────────────── Revenue by plan ───────────────────

function RevenueByPlanTable({
  rows,
  totalCents,
}: {
  rows: RevenuePlanBucket[];
  totalCents: number;
}) {
  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow className="border-[#1f1f1f] hover:bg-transparent">
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">
            Plan
          </TableHead>
          <TableHead className="w-1/3 text-[#888] uppercase text-xs tracking-wider">
            Share
          </TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            Members
          </TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            Monthly
          </TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            % of MRR
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const share = totalCents > 0 ? r.monthly_cents / totalCents : 0;
          return (
            <TableRow
              key={r.plan_id}
              className="border-[#1f1f1f] hover:bg-[#0a0a0a]"
            >
              <TableCell className="font-medium text-white">
                {r.plan_name}
              </TableCell>
              <TableCell>
                <div className="h-1.5 rounded-full bg-[#161616] overflow-hidden">
                  <div
                    className="h-full bg-white/80"
                    style={{ width: `${share * 100}%` }}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right text-[#ccc] tabular-nums">
                {r.members}
              </TableCell>
              <TableCell className="text-right text-white tabular-nums">
                {formatMoney(r.monthly_cents)}
              </TableCell>
              <TableCell className="text-right text-[#aaa] tabular-nums">
                {(share * 100).toFixed(1)}%
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    </div>
  );
}

// ─────────────────── At-risk table ───────────────────

function AtRiskTable({ rows }: { rows: AtRiskRow[] }) {
  return (
    <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow className="border-[#1f1f1f] hover:bg-transparent">
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">
            Name
          </TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">
            Belt
          </TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">
            Status
          </TableHead>
          <TableHead className="text-[#888] uppercase text-xs tracking-wider">
            Last Check-In
          </TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            Days Since
          </TableHead>
          <TableHead className="text-right text-[#888] uppercase text-xs tracking-wider">
            Action
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow
            key={r.id}
            className="border-[#1f1f1f] hover:bg-[#0a0a0a]"
          >
            <TableCell className="font-medium text-white">
              {r.full_name}
            </TableCell>
            <TableCell>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
                  BELT_BADGE[r.belt_rank],
                )}
              >
                {BELT_LABEL[r.belt_rank]}
              </span>
            </TableCell>
            <TableCell className="text-[#aaa] capitalize">{r.status}</TableCell>
            <TableCell className="text-[#aaa] tabular-nums">
              {r.last_check_in
                ? new Date(r.last_check_in).toLocaleDateString()
                : "Never"}
            </TableCell>
            <TableCell
              className={cn(
                "text-right tabular-nums font-medium",
                (r.days_since ?? 0) >= 30 ? "text-red-300" : "text-amber-300",
              )}
            >
              {r.days_since ?? "—"}d
            </TableCell>
            <TableCell className="text-right">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
              >
                <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                Text
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    </div>
  );
}

// ─────────────────── CSV download ───────────────────

function CsvButton({
  filename,
  build,
}: {
  filename: string;
  build: () => string;
}) {
  function onClick() {
    const csv = build();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="h-8 border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
    >
      <Download className="h-3.5 w-3.5 mr-1.5" />
      Export CSV
    </Button>
  );
}

// ─────────────────── Helpers ───────────────────

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
