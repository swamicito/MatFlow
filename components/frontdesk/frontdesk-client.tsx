"use client";

import { useState, useEffect, useTransition, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Plus,
  X,
  Check,
  Clock,
  CalendarDays,
  Loader2,
  ArrowLeft,
  Users,
  LayoutDashboard,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { checkInStudent, appendStudentNote } from "@/app/frontdesk/actions";
import { createStudent, saveWaiver } from "@/app/(dashboard)/students/actions";
import { captureUtmFromUrl, getStoredUtm, clearStoredUtm } from "@/lib/utm";
import { DEFAULT_CLASS, relativeTime } from "@/lib/checkin";
import { ADULT_BELTS, BELT_LABEL } from "@/lib/students";
import { BeltBadge } from "@/components/students/belt-badge";
import { SignaturePad } from "@/components/students/signature-pad";
import type { SignaturePadHandle } from "@/components/students/signature-pad";
import type { CheckinStudent, RecentCheckin, FrontdeskClass, TodayCheckin, WaiverTemplate } from "@/app/frontdesk/page";
import type { BeltRank } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────────────────────

type Mode = "search" | "new-client" | "sign-waiver";

function fmtTime(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${mStr ?? "00"} ${suffix}`;
}

function LiveClock({ date }: { date: Date }) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  const suffix = h >= 12 ? "PM" : "AM";
  return (
    <span className="tabular-nums font-mono">
      {h % 12 || 12}:{m}:{s} {suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function FrontdeskClient({
  students,
  todaysClasses,
  recentCheckins,
  todayCheckins,
  waiverTemplates,
  stats,
  gymName,
}: {
  students: CheckinStudent[];
  todaysClasses: FrontdeskClass[];
  recentCheckins: RecentCheckin[];
  todayCheckins: TodayCheckin[];
  waiverTemplates: WaiverTemplate[];
  stats: { todayCount: number; activeStudents: number };
  gymName: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [success, setSuccess] = useState<{ name: string; context: "checkin" | "new-client" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [showTodayList, setShowTodayList] = useState(false);
  const [warnTarget, setWarnTarget] = useState<CheckinStudent | null>(null);

  // New-client form
  const [nc, setNc] = useState({
    name: "",
    email: "",
    phone: "",
    belt: "white" as BeltRank,
  });

  // Sign-waiver step (entered automatically after New Client creation)
  const [pendingStudent, setPendingStudent] = useState<{ id: string; name: string } | null>(null);
  const [waiverTemplateId, setWaiverTemplateId] = useState("");
  const [swSignedByName, setSwSignedByName] = useState("");
  const [swHasInk, setSwHasInk] = useState(false);
  const swPadRef = useRef<SignaturePadHandle>(null);

  const searchRef = useRef<HTMLInputElement>(null);

  // Capture UTM params from URL on mount (persists to localStorage)
  useEffect(() => {
    captureUtmFromUrl();
  }, []);

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-refresh server data every 30 s
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  // Auto-dismiss success overlay
  useEffect(() => {
    if (!success) return;
    const id = setTimeout(() => setSuccess(null), 3000);
    return () => clearTimeout(id);
  }, [success]);

  // Focus search when switching to search mode
  useEffect(() => {
    if (mode === "search") setTimeout(() => searchRef.current?.focus(), 50);
  }, [mode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students.slice(0, 22);
    const digits = q.replace(/\D+/g, "");
    return students.filter((s) => {
      if (s.full_name.toLowerCase().includes(q)) return true;
      if (digits && s.phone?.replace(/\D+/g, "").includes(digits)) return true;
      return false;
    });
  }, [students, query]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
  }

  function handleCheckIn(student: CheckinStudent) {
    if (pending) return;
    if (!student.has_waiver) { setWarnTarget(student); return; }
    doCheckIn(student.id);
  }

  function doCheckIn(studentId: string) {
    setError(null);
    startTransition(async () => {
      const r = await checkInStudent(studentId, DEFAULT_CLASS);
      if (!r.ok) { setError(r.error); return; }
      setSuccess({ name: r.data.student_name, context: "checkin" });
      setQuery("");
      router.refresh();
    });
  }

  function handleNewClient() {
    if (!nc.name.trim()) { setError("Name is required."); return; }
    setError(null);
    startTransition(async () => {
      const utm = getStoredUtm();
      const r = await createStudent({
        full_name: nc.name,
        email: nc.email || null,
        phone: nc.phone || null,
        belt_rank: nc.belt,
        status: "active",
        source: utm?.source ?? "front_desk",
        utm_source:   utm?.utm_source   ?? null,
        utm_medium:   utm?.utm_medium   ?? null,
        utm_campaign: utm?.utm_campaign ?? null,
        utm_term:     utm?.utm_term     ?? null,
        utm_content:  utm?.utm_content  ?? null,
      });
      if (!r.ok) { setError(r.error); return; }
      clearStoredUtm();
      // Transition to inline waiver step instead of immediate success overlay.
      const defaultTpl = waiverTemplates.find((t) => t.required) ?? waiverTemplates[0];
      setPendingStudent({ id: r.data.id, name: r.data.name });
      setWaiverTemplateId(defaultTpl?.id ?? "");
      setSwSignedByName(r.data.name);
      setSwHasInk(false);
      setNc({ name: "", email: "", phone: "", belt: "white" });
      switchMode("sign-waiver");
      setTimeout(() => swPadRef.current?.clear(), 50);
    });
  }

  function handleSkipWaiver() {
    if (!pendingStudent) return;
    const student = pendingStudent;
    setError(null);
    setPendingStudent(null);
    switchMode("search");
    const skipNote = `⚠ Waiver skipped at front desk on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Follow up required.`;
    startTransition(async () => {
      await Promise.all([
        checkInStudent(student.id, DEFAULT_CLASS),
        appendStudentNote(student.id, skipNote),
      ]);
      setSuccess({ name: student.name, context: "new-client" });
      router.refresh();
    });
  }

  function handleSaveWaiver() {
    if (!pendingStudent) return;
    const dataUrl = swPadRef.current?.toDataURL();
    if (!dataUrl) { setError("Please sign before saving."); return; }
    setError(null);
    const selectedTemplate = waiverTemplates.find((t) => t.id === waiverTemplateId);
    startTransition(async () => {
      const r = await saveWaiver({
        student_id: pendingStudent.id,
        waiver_type: selectedTemplate?.name ?? "general",
        signature_data: dataUrl,
        signed_by_name: swSignedByName || null,
        template_id: waiverTemplateId || null,
      });
      if (!r.ok) { setError(r.error); return; }
      await checkInStudent(pendingStudent.id, DEFAULT_CLASS);
      setSuccess({ name: pendingStudent.name, context: "new-client" });
      setPendingStudent(null);
      setSwHasInk(false);
      switchMode("search");
      router.refresh();
    });
  }

  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const MODES: { id: Mode; label: string; icon: React.ElementType }[] = [
    { id: "search",     label: "Search & Check In", icon: Search },
    { id: "new-client", label: "New Client",         icon: Plus   },
  ];

  // ─────────────────────────────────────────────────────────── render

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden select-none">

      {/* ── Header ── */}
      <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[#1a1a1a] bg-[#050505]">
        <div className="flex items-center gap-4">
          <img src="/logo-full.png" alt="MatFlow" className="h-8 w-auto" />
          <div className="w-px h-6 bg-[#222]" />
          <div>
            <p className="text-sm font-semibold text-white leading-none">{gymName}</p>
            <p className="text-xs text-[#666] leading-none mt-1">{todayLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-[#777]">
            <LiveClock date={now} />
          </p>
          <Link
            href="/dashboard"
            className="h-9 px-4 rounded-xl border border-[#222] text-xs text-[#888] hover:text-white hover:border-[#333] transition-colors inline-flex items-center gap-2"
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            Dashboard
          </Link>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left column ── */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[#1a1a1a]">

          {/* Mode switcher — replaced by a status banner during the sign-waiver step */}
          {mode === "sign-waiver" && pendingStudent ? (
            <div className="shrink-0 px-6 pt-5 pb-5 border-b border-[#111]">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-400 shrink-0" strokeWidth={2.5} />
                <div>
                  <p className="text-sm font-semibold text-white">Student created</p>
                  <p className="text-sm text-[#777]">
                    Collecting waiver for{" "}
                    <span className="font-semibold text-white">{pendingStudent.name}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="shrink-0 px-6 pt-5 pb-5 border-b border-[#111]">
              <div className="grid grid-cols-2 gap-3">
                {MODES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => switchMode(id)}
                    className={cn(
                      "h-14 rounded-2xl border text-sm font-semibold flex items-center justify-center gap-2.5 transition-all active:scale-[0.97]",
                      mode === id
                        ? "bg-white text-black border-white shadow-lg shadow-white/10"
                        : "border-[#222] text-[#888] hover:text-white hover:border-[#333] bg-[#080808]",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode content area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <X className="h-4 w-4 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="ml-auto shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* ── Search mode ── */}
            {mode === "search" && (
              <>
                <div className="relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#555]" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name or phone…"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full h-16 pl-14 pr-12 rounded-2xl bg-[#0a0a0a] border border-[#222] text-lg text-white placeholder:text-[#444] outline-none focus:border-white/25 transition-colors"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-full bg-[#1a1a1a] text-[#888] hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {filtered.length === 0 ? (
                    <div className="py-14 flex flex-col items-center gap-3 text-center">
                      <Users className="h-8 w-8 text-[#2a2a2a]" />
                      <p className="text-sm text-[#555]">
                        {query ? `No students match "${query}"` : "Start typing to search…"}
                      </p>
                    </div>
                  ) : (
                    filtered.map((s) => (
                      <div
                        key={s.id}
                        className={cn(
                          "flex items-center gap-4 h-[72px] px-5 rounded-2xl bg-[#080808] border transition-colors",
                          s.has_waiver
                            ? "border-[#1a1a1a] hover:border-[#2a2a2a]"
                            : "border-amber-500/20 hover:border-amber-500/40",
                        )}
                      >
                        <BeltBadge belt={(s.belt_rank ?? "white") as BeltRank} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-base font-semibold text-white truncate">
                              {s.full_name}
                            </p>
                            {!s.has_waiver && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                No Waiver
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#555] truncate">
                            {s.phone ? `${s.phone}  ·  ` : ""}
                            {s.last_checked_in_at
                              ? `Last in ${relativeTime(s.last_checked_in_at)}`
                              : "No prior check-ins"}
                          </p>
                        </div>
                        <button
                          onClick={() => handleCheckIn(s)}
                          disabled={pending}
                          className="h-11 px-6 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 active:scale-95 transition-all disabled:opacity-40 inline-flex items-center gap-2 shrink-0"
                        >
                          {pending
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Check className="h-4 w-4" strokeWidth={3} />
                          }
                          Check In
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* ── New client mode ── */}
            {mode === "new-client" && (
              <div className="max-w-lg space-y-4">
                <p className="text-sm text-[#555]">
                  Create a new active student record.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={nc.name}
                    onChange={(e) => setNc((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Full name *"
                    autoFocus
                    className="col-span-2 w-full h-14 px-5 rounded-2xl bg-[#0a0a0a] border border-[#222] text-base text-white placeholder:text-[#444] outline-none focus:border-white/25 transition-colors"
                  />
                  <input
                    value={nc.email}
                    onChange={(e) => setNc((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Email"
                    type="email"
                    className="w-full h-14 px-5 rounded-2xl bg-[#0a0a0a] border border-[#222] text-base text-white placeholder:text-[#444] outline-none focus:border-white/25 transition-colors"
                  />
                  <input
                    value={nc.phone}
                    onChange={(e) => setNc((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone"
                    type="tel"
                    className="w-full h-14 px-5 rounded-2xl bg-[#0a0a0a] border border-[#222] text-base text-white placeholder:text-[#444] outline-none focus:border-white/25 transition-colors"
                  />
                  <select
                    value={nc.belt}
                    onChange={(e) => setNc((p) => ({ ...p, belt: e.target.value as BeltRank }))}
                    className="col-span-2 w-full h-14 px-5 rounded-2xl bg-[#0a0a0a] border border-[#222] text-base text-white outline-none focus:border-white/25 transition-colors appearance-none"
                  >
                    {ADULT_BELTS.map((b) => (
                      <option key={b} value={b} className="bg-black">
                        {BELT_LABEL[b]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleNewClient}
                  disabled={pending || !nc.name.trim()}
                  className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {pending
                    ? <Loader2 className="h-5 w-5 animate-spin" />
                    : <Plus className="h-5 w-5" />
                  }
                  Create Student
                </button>
              </div>
            )}

            {/* ── Sign-waiver step ── */}
            {mode === "sign-waiver" && pendingStudent && (
              <div className="max-w-lg space-y-5">

                {/* Template selector */}
                {waiverTemplates.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-widest text-[#555]">Waiver type</p>
                    <select
                      value={waiverTemplateId}
                      onChange={(e) => setWaiverTemplateId(e.target.value)}
                      className="w-full h-12 px-4 rounded-2xl bg-[#0a0a0a] border border-[#222] text-sm text-white outline-none focus:border-white/25 transition-colors appearance-none"
                    >
                      {waiverTemplates.map((t) => (
                        <option key={t.id} value={t.id} className="bg-black">
                          {t.name}{t.required ? " ★" : ""}
                        </option>
                      ))}
                    </select>
                    {waiverTemplates.some((t) => t.required) && (
                      <p className="text-[11px] text-[#555]">★ Required by gym policy</p>
                    )}
                  </div>
                )}

                {/* Signed by */}
                <div className="space-y-2">
                  <p className="text-[11px] uppercase tracking-widest text-[#555]">Signed by (full name)</p>
                  <input
                    value={swSignedByName}
                    onChange={(e) => setSwSignedByName(e.target.value)}
                    placeholder={pendingStudent.name}
                    className="w-full h-12 px-5 rounded-2xl bg-[#0a0a0a] border border-[#222] text-base text-white placeholder:text-[#444] outline-none focus:border-white/25 transition-colors"
                  />
                </div>

                {/* Signature pad */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-widest text-[#555]">Signature</p>
                    <button
                      type="button"
                      onClick={() => { swPadRef.current?.clear(); setSwHasInk(false); }}
                      disabled={!swHasInk}
                      className="text-xs text-[#666] hover:text-white disabled:opacity-30 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <SignaturePad
                    ref={swPadRef}
                    heightClassName="h-44"
                    onInkChange={setSwHasInk}
                  />
                  <p className="text-xs text-[#555]">
                    By signing, the named individual acknowledges the gym&apos;s liability
                    waiver and assumes responsibility for risk of participation.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSkipWaiver}
                    disabled={pending}
                    className="flex-1 h-12 rounded-2xl border border-[#222] text-sm text-[#888] hover:text-white hover:border-[#333] transition-colors"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={handleSaveWaiver}
                    disabled={pending || !swHasInk}
                    className="flex-1 h-12 rounded-2xl bg-white text-black text-sm font-bold hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {pending
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Check className="h-4 w-4" strokeWidth={3} />
                    }
                    Save Signature
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="w-[300px] shrink-0 flex flex-col overflow-hidden bg-[#040404]">

          {/* Stats */}
          <div className="shrink-0 grid grid-cols-2 border-b border-[#111]">
            <button
              onClick={() => setShowTodayList((v) => !v)}
              className="px-5 py-5 border-r border-[#111] text-left hover:bg-[#070707] transition-colors group"
            >
              <p className="text-[9px] uppercase tracking-widest text-[#444] mb-2">Today</p>
              <div className="flex items-end gap-1.5">
                <p className="text-4xl font-bold tabular-nums">{stats.todayCount}</p>
                <ChevronDown className={cn(
                  "h-4 w-4 text-[#444] mb-1.5 transition-transform group-hover:text-[#666]",
                  showTodayList && "rotate-180",
                )} />
              </div>
              <p className="text-xs text-[#555] mt-1">check-ins</p>
            </button>
            <div className="px-5 py-5">
              <p className="text-[9px] uppercase tracking-widest text-[#444] mb-2">Active</p>
              <p className="text-4xl font-bold tabular-nums">{stats.activeStudents}</p>
              <p className="text-xs text-[#555] mt-1">students</p>
            </div>
          </div>

          {/* Today's check-ins expandable list */}
          {showTodayList && (
            <div className="shrink-0 border-b border-[#111] max-h-60 overflow-y-auto">
              {todayCheckins.length === 0 ? (
                <p className="px-5 py-3 text-xs text-[#444]">No check-ins yet today.</p>
              ) : (
                <ul>
                  {todayCheckins.map((c) => (
                    <li
                      key={c.attendance_id}
                      className="flex items-center justify-between px-5 py-2.5 border-b border-[#0d0d0d] last:border-0"
                    >
                      <div className="min-w-0 flex items-center gap-1.5">
                        {!c.has_waiver && (
                          <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm text-white truncate">{c.student_name}</p>
                          {c.class_type && (
                            <p className="text-[11px] text-[#555] truncate">{c.class_type}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-[#666] tabular-nums ml-3 shrink-0 whitespace-nowrap">
                        {relativeTime(c.checked_in_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex-1 overflow-y-auto divide-y divide-[#0d0d0d]">

            {/* Today's schedule */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-3 w-3 text-[#444]" />
                <p className="text-[9px] uppercase tracking-widest text-[#444]">
                  Today&apos;s Schedule
                </p>
              </div>
              {todaysClasses.length === 0 ? (
                <p className="text-xs text-[#444] py-2">No classes scheduled.</p>
              ) : (
                <ul className="space-y-px">
                  {todaysClasses.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between py-2.5 border-b border-[#0d0d0d] last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{c.title}</p>
                        {c.instructor_name && (
                          <p className="text-[11px] text-[#555] truncate">{c.instructor_name}</p>
                        )}
                      </div>
                      <span className="text-xs text-[#666] tabular-nums ml-3 shrink-0">
                        {fmtTime(c.start_time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Recent check-ins */}
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-3 w-3 text-[#444]" />
                <p className="text-[9px] uppercase tracking-widest text-[#444]">
                  Recent (30 min)
                </p>
              </div>
              {recentCheckins.length === 0 ? (
                <p className="text-xs text-[#444] py-2">No check-ins yet.</p>
              ) : (
                <ul className="space-y-px">
                  {recentCheckins.map((r) => (
                    <li
                      key={r.attendance_id}
                      className="flex items-center justify-between py-2.5 border-b border-[#0d0d0d] last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{r.student_name}</p>
                        {r.class_type && (
                          <p className="text-[11px] text-[#555] truncate">{r.class_type}</p>
                        )}
                      </div>
                      <span className="text-xs text-[#666] tabular-nums ml-3 shrink-0 whitespace-nowrap">
                        {relativeTime(r.checked_in_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Quick links */}
            <div className="px-5 py-4">
              <p className="text-[9px] uppercase tracking-widest text-[#444] mb-3">Quick Links</p>
              <div className="space-y-2">
                {[
                  { href: "/students", label: "Student Directory" },
                  { href: "/leads",    label: "Leads"             },
                  { href: "/schedule", label: "Full Schedule"     },
                  { href: "/billing",  label: "Billing"           },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center justify-between h-10 px-4 rounded-xl bg-[#080808] border border-[#141414] text-xs text-[#888] hover:text-white hover:border-[#222] transition-colors"
                  >
                    {label}
                    <ArrowLeft className="h-3 w-3 rotate-180 text-[#444]" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── No-waiver warning overlay ── */}
      {warnTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/92 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-auto px-6 space-y-6 text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-amber-500/15 border-2 border-amber-500/50 grid place-items-center">
              <AlertTriangle className="h-10 w-10 text-amber-400" strokeWidth={2} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{warnTarget.full_name}</p>
              <p className="text-base text-amber-300 mt-2 font-semibold">No waiver on file</p>
              <p className="text-sm text-[#888] mt-1">
                This student has never signed a liability waiver.
                Checking them in may create legal exposure.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setWarnTarget(null)}
                className="flex-1 h-12 rounded-2xl border border-[#333] text-sm text-[#aaa] hover:text-white hover:border-[#555] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { const id = warnTarget.id; setWarnTarget(null); doCheckIn(id); }}
                className="flex-1 h-12 rounded-2xl bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 active:scale-[0.98] transition-all"
              >
                Check In Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success overlay ── */}
      {success && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/92 backdrop-blur-sm">
          <div className="text-center space-y-6 px-8">
            <div className="mx-auto h-32 w-32 rounded-full bg-emerald-500/15 border-2 border-emerald-500/60 grid place-items-center">
              <Check className="h-16 w-16 text-emerald-400" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-5xl font-bold tracking-tight text-white">{success.name}</p>
              <p className="text-xl text-[#888] mt-3">
                {success.context === "new-client"
                  ? "Student created & checked in"
                  : "Checked in successfully"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
