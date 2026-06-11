"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, Search, UserPlus, X } from "lucide-react";
import {
  CLASS_TYPES,
  DEFAULT_CLASS,
  TODAYS_CLASSES,
  relativeTime,
  type ClassType,
} from "@/lib/checkin";
import { BeltBadge } from "@/components/students/belt-badge";
import {
  checkInStudent,
  walkInCheckIn,
} from "@/app/checkin/actions";
import type { CheckinStudent, RecentCheckin } from "@/app/checkin/page";
import { cn } from "@/lib/utils";
import type { BeltRank } from "@/lib/supabase/types";

type SuccessState = { name: string; classType: ClassType } | null;

export function CheckinClient({
  students,
  recent,
}: {
  students: CheckinStudent[];
  recent: RecentCheckin[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [classType, setClassType] = useState<ClassType>(DEFAULT_CLASS);
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<SuccessState>(null);
  const [error, setError] = useState<string | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  // Re-render once a minute so "x min ago" labels stay accurate.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Refresh server data periodically so attendance from other tabs appears.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Keep tick referenced so the timer triggers re-render of relative times.
  void tick;

  // Auto-dismiss success overlay
  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 2500);
    return () => clearTimeout(id);
  }, [success]);

  // Focus search on mount and after every successful check-in
  useEffect(() => {
    if (!success) searchRef.current?.focus();
  }, [success]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 30); // show a manageable default
    const digits = q.replace(/\D+/g, "");
    return students.filter((s) => {
      if (s.full_name.toLowerCase().includes(q)) return true;
      if (digits && s.phone && s.phone.replace(/\D+/g, "").includes(digits)) {
        return true;
      }
      return false;
    });
  }, [students, query]);

  function onCheckIn(studentId: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await checkInStudent(studentId, classType);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess({ name: result.data.student_name, classType });
      setQuery("");
      router.refresh();
    });
  }

  function onWalkIn(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await walkInCheckIn(
        String(formData.get("name") ?? ""),
        String(formData.get("phone") ?? ""),
        classType,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setWalkInOpen(false);
      setSuccess({ name: result.data.student_name, classType });
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen relative">
      {/* Top bar */}
      <header className="flex items-center justify-between gap-4 px-6 md:px-10 py-5 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-white text-black grid place-items-center font-bold">
            M
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-[#888]">
              MatFlow Check-In
            </p>
            <p className="text-base md:text-lg font-semibold">
              Asbury Park Jiu-Jitsu
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => setWalkInOpen(true)}
            className="h-12 md:h-14 px-4 md:px-5 rounded-lg border border-[#222] hover:bg-[#111] flex items-center gap-2 text-sm md:text-base font-medium transition-colors"
          >
            <UserPlus className="h-5 w-5" />
            Walk-in
          </button>
          <Link
            href="/dashboard"
            className="h-12 w-12 grid place-items-center rounded-lg border border-[#222] hover:bg-[#111] transition-colors"
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
      </header>

      {/* Class selector */}
      <div className="px-6 md:px-10 pt-6">
        <p className="text-xs uppercase tracking-widest text-[#666] mb-2">
          Current Class
        </p>
        <div className="flex flex-wrap gap-2">
          {CLASS_TYPES.map((c) => {
            const active = c === classType;
            return (
              <button
                key={c}
                onClick={() => setClassType(c)}
                className={cn(
                  "h-12 px-5 rounded-full border text-sm md:text-base font-medium transition-colors",
                  active
                    ? "border-white bg-white text-black"
                    : "border-[#222] bg-transparent text-[#bbb] hover:bg-[#111] hover:text-white",
                )}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <main className="px-6 md:px-10 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: search + results */}
        <section className="space-y-5">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-[#666]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or phone..."
              className="w-full h-20 pl-16 pr-6 rounded-xl bg-[#0a0a0a] border border-[#222] text-2xl text-white placeholder:text-[#555] outline-none focus:border-white/40 focus:ring-2 focus:ring-white/10"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2 flex items-center gap-2">
              <X className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <EmptyState query={query} onWalkIn={() => setWalkInOpen(true)} />
            ) : (
              filtered.map((s) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  onCheckIn={() => onCheckIn(s.id)}
                  disabled={pending}
                />
              ))
            )}
          </div>
        </section>

        {/* Right: today's classes + recent check-ins */}
        <aside className="space-y-6">
          <Panel title="Today's Classes">
            <ul className="divide-y divide-[#161616]">
              {TODAYS_CLASSES.map((c) => (
                <li
                  key={c.time + c.label}
                  className="flex items-center justify-between py-3"
                >
                  <span className="text-sm text-white">{c.label}</span>
                  <span className="text-xs text-[#888] tabular-nums">
                    {c.time}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Recent Check-Ins" subtitle="last 30 min">
            {recent.length === 0 ? (
              <p className="text-sm text-[#666] py-4 text-center">
                No check-ins yet.
              </p>
            ) : (
              <ul className="divide-y divide-[#161616]">
                {recent.map((r) => (
                  <li
                    key={r.attendance_id}
                    className="flex items-center justify-between py-3 gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        {r.student_name}
                      </p>
                      <p className="text-xs text-[#666] truncate">
                        {r.class_type ?? "—"}
                      </p>
                    </div>
                    <span className="text-xs text-[#888] tabular-nums whitespace-nowrap">
                      {relativeTime(r.checked_in_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </main>

      {/* Success overlay */}
      {success && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 backdrop-blur-sm animate-in fade-in-0">
          <div className="text-center space-y-6 px-6">
            <div className="mx-auto h-32 w-32 rounded-full bg-emerald-500/15 border-2 border-emerald-400 grid place-items-center">
              <Check className="h-16 w-16 text-emerald-300" strokeWidth={3} />
            </div>
            <div className="space-y-2">
              <p className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
                {success.name}
              </p>
              <p className="text-lg md:text-xl text-[#aaa]">
                Checked in successfully · {success.classType}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Walk-in overlay */}
      {walkInOpen && (
        <WalkInOverlay
          onClose={() => setWalkInOpen(false)}
          onSubmit={onWalkIn}
          pending={pending}
          classType={classType}
        />
      )}
    </div>
  );
}

// ───────────────────────── Sub-components ─────────────────────────

function StudentRow({
  student,
  onCheckIn,
  disabled,
}: {
  student: CheckinStudent;
  onCheckIn: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 md:p-5 rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] hover:border-[#2a2a2a] transition-colors">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-xl md:text-2xl font-semibold text-white truncate">
            {student.full_name}
          </p>
          <BeltBadge belt={(student.belt_rank ?? "white") as BeltRank} />
        </div>
        <p className="text-sm text-[#888]">
          {student.phone ?? "—"}
          {" · "}
          {student.last_checked_in_at
            ? `Last in ${relativeTime(student.last_checked_in_at)}`
            : "No prior check-ins"}
        </p>
      </div>
      <button
        onClick={onCheckIn}
        disabled={disabled}
        className="h-16 md:h-[68px] px-6 md:px-8 rounded-xl bg-white text-black text-base md:text-lg font-semibold hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
      >
        <Check className="h-5 w-5" strokeWidth={3} />
        Check In
      </button>
    </div>
  );
}

function EmptyState({
  query,
  onWalkIn,
}: {
  query: string;
  onWalkIn: () => void;
}) {
  if (!query) {
    return (
      <div className="rounded-xl border border-dashed border-[#222] p-10 text-center text-[#888]">
        Start typing a name or phone number.
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-[#222] p-10 text-center space-y-4">
      <p className="text-[#aaa]">
        No students match <span className="text-white">&quot;{query}&quot;</span>.
      </p>
      <button
        onClick={onWalkIn}
        className="h-12 px-5 rounded-lg bg-white text-black font-medium hover:bg-white/90 transition-colors inline-flex items-center gap-2"
      >
        <UserPlus className="h-4 w-4" />
        Add as Walk-in
      </button>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-5">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs uppercase tracking-widest text-[#888]">
          {title}
        </h3>
        {subtitle && (
          <span className="text-[10px] uppercase tracking-widest text-[#555]">
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function WalkInOverlay({
  onClose,
  onSubmit,
  pending,
  classType,
}: {
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  pending: boolean;
  classType: ClassType;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Walk-in Check-in</h2>
            <p className="text-sm text-[#888] mt-1">
              Creates a trial student and checks them in to{" "}
              <span className="text-white">{classType}</span>.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-10 w-10 grid place-items-center rounded-lg border border-[#222] hover:bg-[#111]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-[#bbb]" htmlFor="wi-name">
              Name
            </label>
            <input
              id="wi-name"
              name="name"
              required
              autoFocus
              placeholder="Full name"
              className="w-full h-14 px-4 rounded-lg bg-black border border-[#222] text-lg text-white placeholder:text-[#555] outline-none focus:border-white/40"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-[#bbb]" htmlFor="wi-phone">
              Phone (optional)
            </label>
            <input
              id="wi-phone"
              name="phone"
              type="tel"
              placeholder="(555) 555-5555"
              className="w-full h-14 px-4 rounded-lg bg-black border border-[#222] text-lg text-white placeholder:text-[#555] outline-none focus:border-white/40"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="w-full h-16 rounded-xl bg-white text-black text-lg font-semibold hover:bg-white/90 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {pending ? "Checking in..." : "Add & Check In"}
          </button>
        </form>
      </div>
    </div>
  );
}
