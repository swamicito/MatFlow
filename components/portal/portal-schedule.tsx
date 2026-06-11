"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Users, CalendarDays, Loader2, CheckCircle2, XCircle, LayoutList, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { bookClass, cancelBooking } from "@/app/(dashboard)/schedule/actions";
import type { ClassWithBooking, ClassRow } from "@/app/(dashboard)/schedule/actions";

// ─────────────────────────────────────────────────────────────────────────────
// Constants + helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAYS: { label: string; short: string; value: number }[] = [
  { label: "Monday",    short: "Mon", value: 1 },
  { label: "Tuesday",   short: "Tue", value: 2 },
  { label: "Wednesday", short: "Wed", value: 3 },
  { label: "Thursday",  short: "Thu", value: 4 },
  { label: "Friday",    short: "Fri", value: 5 },
  { label: "Saturday",  short: "Sat", value: 6 },
  { label: "Sunday",    short: "Sun", value: 0 },
];

const DAY_LABELS: Record<number, string> = {
  0: "Sunday", 1: "Monday", 2: "Tuesday", 3: "Wednesday",
  4: "Thursday", 5: "Friday", 6: "Saturday",
};

function fmtTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// List Row — default mobile-first view, no truncation
// ─────────────────────────────────────────────────────────────────────────────

function ClassListRow({
  cls,
  studentId,
}: {
  cls: ClassWithBooking;
  studentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isFull = cls.booking_count >= cls.capacity && !cls.is_booked;
  const spotsLeft = Math.max(0, cls.capacity - cls.booking_count);

  function handleBook() {
    startTransition(async () => {
      const result = await bookClass(cls.id, studentId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("You're signed up!");
      router.refresh();
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelBooking(cls.id, studentId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Booking cancelled");
      router.refresh();
    });
  }

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-4 border-b border-[#111] last:border-0 transition-colors",
      cls.is_booked ? "bg-white/[0.025]" : "active:bg-[#0d0d0d]",
    )}>
      {/* Time column */}
      <div className="w-[58px] shrink-0 text-right">
        <p className={cn(
          "text-xs font-bold tabular-nums leading-tight",
          isFull ? "text-[#666]" : cls.is_booked ? "text-emerald-400" : "text-white",
        )}>
          {fmtTime(cls.start_time)}
        </p>
        <p className="text-[10px] text-[#666] tabular-nums mt-0.5">
          {fmtTime(cls.end_time)}
        </p>
      </div>

      {/* Vertical divider */}
      <div className={cn(
        "w-px h-10 shrink-0 rounded-full",
        cls.is_booked ? "bg-emerald-500/30" : "bg-[#1c1c1c]",
      )} />

      {/* Class info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className={cn(
          "text-sm font-bold leading-snug",
          isFull ? "text-[#777]" : "text-white",
        )}>
          {cls.title}
        </p>
        {cls.instructor_name && (
          <p className="text-[11px] text-[#999]">{cls.instructor_name}</p>
        )}
        <span className={cn(
          "inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 border",
          isFull
            ? "bg-transparent text-[#777] border-[#1f1f1f]"
            : cls.is_booked
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
              : spotsLeft <= 3
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-[#111] text-[#999] border-[#1c1c1c]",
        )}>
          <Users className="h-2.5 w-2.5" />
          {cls.is_booked
            ? "Signed up"
            : isFull
              ? "Class full"
              : `${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* CTA */}
      <div className="shrink-0 ml-1">
        {cls.is_booked ? (
          <button
            onClick={handleCancel}
            disabled={pending}
            className="h-8 px-3 rounded-xl border border-[#1f1f1f] text-[10px] text-[#999] hover:text-red-400 hover:border-red-500/25 transition-colors disabled:opacity-40 inline-flex items-center gap-1"
          >
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
            Cancel
          </button>
        ) : (
          <button
            onClick={handleBook}
            disabled={pending || isFull}
            className={cn(
              "h-9 px-4 rounded-xl text-[12px] font-bold tracking-wide transition-all inline-flex items-center gap-1.5 whitespace-nowrap",
              isFull
                ? "border border-[#1a1a1a] text-[#999] cursor-not-allowed"
                : "bg-white text-black hover:bg-white/90 active:scale-[0.97] shadow-sm",
            )}
          >
            {pending && <Loader2 className="h-3 w-3 animate-spin text-black" />}
            {isFull ? "Full" : "Sign Up"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Grid Card — compact card for the optional grid view
// ─────────────────────────────────────────────────────────────────────────────

function ClassGridCard({
  cls,
  studentId,
}: {
  cls: ClassWithBooking;
  studentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isFull = cls.booking_count >= cls.capacity && !cls.is_booked;
  const spotsLeft = Math.max(0, cls.capacity - cls.booking_count);

  function handleBook() {
    startTransition(async () => {
      const result = await bookClass(cls.id, studentId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("You're signed up!");
      router.refresh();
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelBooking(cls.id, studentId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Booking cancelled");
      router.refresh();
    });
  }

  return (
    <div className={cn(
      "rounded-xl border overflow-hidden transition-all",
      cls.is_booked
        ? "border-white/10 bg-white/[0.03]"
        : isFull
          ? "border-[#1a1a1a] bg-[#080808]"
          : "border-[#1f1f1f] bg-[#0a0a0a] hover:border-[#2d2d2d]",
    )}>
      <div className="p-3 space-y-2">
        <p className={cn(
          "text-[11px] font-bold leading-tight",
          isFull ? "text-[#777]" : "text-white",
        )}>
          {cls.title}
        </p>
        {cls.instructor_name && (
          <p className="text-[10px] text-[#777] truncate">{cls.instructor_name}</p>
        )}
        <div className="flex items-center gap-1 text-[10px] text-[#777]">
          <Clock className="h-2.5 w-2.5 shrink-0" />
          <span className="tabular-nums">{fmtTime(cls.start_time)}</span>
        </div>
        <span className={cn(
          "inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-1.5 py-0.5 border",
          isFull
            ? "text-[#999] border-[#1a1a1a]"
            : cls.is_booked
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : spotsLeft <= 3
                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                : "bg-[#111] text-[#999] border-[#1f1f1f]",
        )}>
          <Users className="h-2 w-2" />
          {cls.is_booked ? "Booked" : isFull ? "Full" : `${spotsLeft}`}
        </span>
      </div>
      <div className="px-3 pb-3">
        {cls.is_booked ? (
          <button
            onClick={handleCancel}
            disabled={pending}
            className="w-full h-6 rounded-lg border border-[#222] text-[9px] text-[#999] hover:text-red-400 hover:border-red-500/25 transition-colors disabled:opacity-40 inline-flex items-center justify-center gap-1"
          >
            {pending ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <XCircle className="h-2.5 w-2.5" />}
            Cancel
          </button>
        ) : (
          <button
            onClick={handleBook}
            disabled={pending || isFull}
            className={cn(
              "w-full h-7 rounded-lg text-[10px] font-bold transition-all inline-flex items-center justify-center",
              isFull
                ? "border border-[#1a1a1a] text-[#999] cursor-not-allowed"
                : "bg-white text-black hover:bg-white/90 active:scale-[0.98]",
            )}
          >
            {pending && <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />}
            {isFull ? "Full" : "Sign Up"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// My Bookings row
// ─────────────────────────────────────────────────────────────────────────────

function MyBookingRow({
  cls,
  studentId,
}: {
  cls: ClassRow;
  studentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelBooking(cls.id, studentId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Booking cancelled");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-[#0f0f0f] last:border-0">
      <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center shrink-0">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">{cls.title}</p>
        <p className="text-xs text-[#999] mt-0.5">
          {DAY_LABELS[cls.day_of_week]} · {fmtTime(cls.start_time)} – {fmtTime(cls.end_time)}
          {cls.instructor_name ? <span className="text-[#777]"> · {cls.instructor_name}</span> : null}
        </p>
      </div>
      <button
        onClick={handleCancel}
        disabled={pending}
        className="shrink-0 h-8 px-3 rounded-xl border border-[#1f1f1f] text-[11px] text-[#999] hover:text-red-400 hover:border-red-500/25 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
      >
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
        Cancel
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PortalSchedule
// ─────────────────────────────────────────────────────────────────────────────

export function PortalSchedule({
  classes,
  myBookings,
  studentId,
}: {
  classes: ClassWithBooking[];
  myBookings: ClassRow[];
  studentId: string;
}) {
  const [view, setView] = useState<"list" | "grid">("list");

  const todayDow = new Date().getDay(); // 0=Sun … 6=Sat

  const byDay = DAYS.reduce<Record<number, ClassWithBooking[]>>((acc, d) => {
    acc[d.value] = classes.filter((c) => c.day_of_week === d.value);
    return acc;
  }, {});

  const daysWithClasses = DAYS.filter((d) => (byDay[d.value]?.length ?? 0) > 0);
  const hasAnyClass = classes.length > 0;

  return (
    <div className="space-y-6">
      {/* ── My Bookings ── */}
      {myBookings.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white tracking-tight">My Bookings</h2>
            </div>
            <span className="text-xs text-[#777] font-medium">
              {myBookings.length} class{myBookings.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="rounded-2xl border border-[#1a1a1a] bg-[#080808] px-4">
            {myBookings.map((cls) => (
              <MyBookingRow key={cls.id} cls={cls} studentId={studentId} />
            ))}
          </div>
        </div>
      )}

      {/* ── Header + view toggle ── */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weekly Schedule</h1>
          <p className="text-sm text-[#999] mt-0.5">
            {hasAnyClass
              ? `${classes.length} class${classes.length !== 1 ? "es" : ""} available`
              : "No classes scheduled yet"}
          </p>
        </div>

        {hasAnyClass && (
          <div className="flex items-center rounded-xl border border-[#1f1f1f] p-1 bg-[#080808] gap-0.5 shrink-0">
            <button
              onClick={() => setView("list")}
              className={cn(
                "h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1.5",
                view === "list"
                  ? "bg-white text-black shadow-sm"
                  : "text-[#888] hover:text-white",
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setView("grid")}
              className={cn(
                "h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1.5",
                view === "grid"
                  ? "bg-white text-black shadow-sm"
                  : "text-[#888] hover:text-white",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
          </div>
        )}
      </div>

      {/* ── Empty state ── */}
      {!hasAnyClass && (
        <div className="rounded-2xl border border-[#1a1a1a] bg-[#080808] py-20 flex flex-col items-center gap-4">
          <div className="h-16 w-16 grid place-items-center rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f]">
            <CalendarDays className="h-7 w-7 text-[#999]" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-white">No classes scheduled</p>
            <p className="text-xs text-[#999]">Your gym hasn&apos;t added any classes yet.</p>
          </div>
        </div>
      )}

      {/* ── List view (default) ── */}
      {hasAnyClass && view === "list" && (
        <div className="space-y-5">
          {daysWithClasses.map((day) => {
            const dayCls = byDay[day.value] ?? [];
            const isToday = day.value === todayDow;
            return (
              <div key={day.value}>
                {/* Day header */}
                <div className="flex items-center gap-3 mb-2.5">
                  <div className={cn(
                    "h-9 w-9 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 border",
                    isToday
                      ? "bg-white text-black border-white/20"
                      : "bg-[#0f0f0f] text-[#999] border-[#1a1a1a]",
                  )}>
                    {day.short}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      "text-sm font-bold",
                      isToday ? "text-white" : "text-[#aaa]",
                    )}>
                      {day.label}
                    </span>
                    {isToday && (
                      <span className="ml-2 text-[10px] bg-white/10 text-white/60 rounded-full px-2 py-0.5 font-medium">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#999] font-medium tabular-nums shrink-0">
                    {dayCls.length} class{dayCls.length !== 1 ? "es" : ""}
                  </span>
                </div>

                {/* Class rows card */}
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#080808] overflow-hidden">
                  {dayCls.map((cls) => (
                    <ClassListRow key={cls.id} cls={cls} studentId={studentId} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Grid view ── */}
      {hasAnyClass && view === "grid" && (
        <div className="overflow-x-auto -mx-5 px-5">
          <div className="grid grid-cols-7 gap-2 min-w-[700px]">
            {DAYS.map((day) => {
              const dayCls = byDay[day.value] ?? [];
              const isToday = day.value === todayDow;
              return (
                <div key={day.value} className="flex flex-col gap-2">
                  <div className={cn(
                    "pb-1.5 border-b",
                    isToday ? "border-white/20" : "border-[#111]",
                  )}>
                    <div className="flex items-center justify-between px-0.5">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isToday ? "text-white" : "text-[#777]",
                      )}>
                        {day.short}
                      </span>
                      {dayCls.length > 0 && (
                        <span className="text-[10px] text-[#777] font-semibold tabular-nums">
                          {dayCls.length}
                        </span>
                      )}
                    </div>
                  </div>
                  {dayCls.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#0f0f0f] py-8 grid place-items-center">
                      <span className="text-[10px] text-[#1a1a1a] select-none">—</span>
                    </div>
                  ) : (
                    dayCls.map((cls) => (
                      <ClassGridCard key={cls.id} cls={cls} studentId={studentId} />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
