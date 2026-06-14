"use client";

import { useState, useTransition } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Clock,
  Users,
  CalendarDays,
  RefreshCw,
  LayoutList,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  createClass,
  updateClass,
  deleteClass,
} from "@/app/(dashboard)/schedule/actions";
import type { ClassRow, ClassFormData } from "@/app/(dashboard)/schedule/actions";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
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

function fmtTime(t: string): string {
  // "HH:MM:SS" or "HH:MM" → "9:00 AM"
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

function spotsLabel(booked: number, capacity: number): string {
  const remaining = capacity - booked;
  if (remaining <= 0) return "Full";
  return `${booked} / ${capacity}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Class card
// ─────────────────────────────────────────────────────────────────────────────

function ClassCard({
  cls,
  onEdit,
  onDelete,
}: {
  cls: ClassRow;
  onEdit: (cls: ClassRow) => void;
  onDelete: (cls: ClassRow) => void;
}) {
  const isFull = cls.booking_count >= cls.capacity;
  return (
    <div className="group relative rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-3 hover:border-[#2a2a2a] transition-colors">
      {/* Actions */}
      <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
        <button
          onClick={() => onEdit(cls)}
          className="h-6 w-6 grid place-items-center rounded-md text-[#999] hover:text-white hover:bg-[#1a1a1a] transition-colors"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(cls)}
          className="h-6 w-6 grid place-items-center rounded-md text-[#999] hover:text-red-400 hover:bg-[#1a1a1a] transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      <p className="text-xs font-semibold text-white leading-tight pr-10 truncate">{cls.title}</p>

      {cls.instructor_name && (
        <p className="text-[11px] text-[#999] mt-0.5 truncate">{cls.instructor_name}</p>
      )}

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className="inline-flex items-center gap-1 text-[10px] text-[#666]">
          <Clock className="h-2.5 w-2.5" />
          {fmtTime(cls.start_time)}–{fmtTime(cls.end_time)}
        </span>
        <span className={cn(
          "inline-flex items-center gap-1 text-[10px] rounded-full px-1.5 py-0.5",
          isFull
            ? "bg-red-500/10 text-red-400 border border-red-500/20"
            : "bg-[#1a1a1a] text-[#888] border border-[#222]",
        )}>
          <Users className="h-2.5 w-2.5" />
          {spotsLabel(cls.booking_count, cls.capacity)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// List row — used in list view
// ─────────────────────────────────────────────────────────────────────────────

function ClassListItem({
  cls,
  onEdit,
  onDelete,
}: {
  cls: ClassRow;
  onEdit: (cls: ClassRow) => void;
  onDelete: (cls: ClassRow) => void;
}) {
  const isFull = cls.booking_count >= cls.capacity;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#111] last:border-0 hover:bg-[#0a0a0a] transition-colors group">
      {/* Time */}
      <div className="w-[66px] shrink-0 text-right">
        <p className="text-xs font-bold text-white tabular-nums">{fmtTime(cls.start_time)}</p>
        <p className="text-[10px] text-[#666] tabular-nums mt-0.5">{fmtTime(cls.end_time)}</p>
      </div>
      {/* Divider */}
      <div className="w-px h-9 bg-[#1c1c1c] shrink-0 rounded-full" />
      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-semibold text-white leading-tight">{cls.title}</p>
        {cls.instructor_name && (
          <p className="text-xs text-[#999]">{cls.instructor_name}</p>
        )}
        <span className={cn(
          "inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 border",
          isFull
            ? "bg-red-500/10 text-red-400 border-red-500/20"
            : "bg-[#111] text-[#999] border-[#1c1c1c]",
        )}>
          <Users className="h-2.5 w-2.5" />
          {isFull ? "Full" : `${cls.booking_count} / ${cls.capacity}`}
        </span>
      </div>
      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onEdit(cls)}
          className="h-8 w-8 grid place-items-center rounded-xl border border-[#1f1f1f] text-[#999] hover:text-white hover:bg-[#1a1a1a] transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(cls)}
          className="h-8 w-8 grid place-items-center rounded-xl border border-[#1f1f1f] text-[#999] hover:text-red-400 hover:bg-[#1a1a1a] transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Class Form Dialog
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_FORM: ClassFormData = {
  title: "",
  instructor_name: "",
  day_of_week: 1,
  start_time: "09:00",
  end_time: "10:00",
  capacity: 20,
  is_recurring: true,
};

function ClassFormDialog({
  editing,
  defaultDay,
  onClose,
}: {
  editing: ClassRow | null;
  defaultDay: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<ClassFormData>(
    editing
      ? {
          title: editing.title,
          instructor_name: editing.instructor_name,
          day_of_week: editing.day_of_week,
          start_time: editing.start_time.slice(0, 5),
          end_time: editing.end_time.slice(0, 5),
          capacity: editing.capacity,
          is_recurring: editing.is_recurring,
        }
      : { ...DEFAULT_FORM, day_of_week: defaultDay },
  );

  function set<K extends keyof ClassFormData>(key: K, val: ClassFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = editing
        ? await updateClass(editing.id, form)
        : await createClass(form);

      if (!result.ok) { toast.error(result.error); return; }
      toast.success(editing ? "Class updated" : "Class created");
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-[#0a0a0a] border border-[#1f1f1f] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#141414] shrink-0">
          <h2 className="text-base font-bold text-white">
            {editing ? "Edit Class" : "New Class"}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-full text-[#999] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#888] font-medium uppercase tracking-wider">Class Title</label>
            <input
              type="text"
              placeholder="e.g. BJJ GI – All Levels"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#333] transition-colors"
            />
          </div>

          {/* Instructor */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#888] font-medium uppercase tracking-wider">Instructor</label>
            <input
              type="text"
              placeholder="e.g. Professor Silva"
              value={form.instructor_name}
              onChange={(e) => set("instructor_name", e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white placeholder:text-[#777] focus:outline-none focus:border-[#333] transition-colors"
            />
          </div>

          {/* Day of week */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#888] font-medium uppercase tracking-wider">Day of Week</label>
            <select
              value={form.day_of_week}
              onChange={(e) => set("day_of_week", Number(e.target.value))}
              className="w-full h-10 px-3.5 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white focus:outline-none focus:border-[#333] transition-colors appearance-none"
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          {/* Times */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-[#888] font-medium uppercase tracking-wider">Start Time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => set("start_time", e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white focus:outline-none focus:border-[#333] transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-[#888] font-medium uppercase tracking-wider">End Time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => set("end_time", e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white focus:outline-none focus:border-[#333] transition-colors"
              />
            </div>
          </div>

          {/* Capacity */}
          <div className="space-y-1.5">
            <label className="text-xs text-[#888] font-medium uppercase tracking-wider">Capacity</label>
            <input
              type="number"
              min={1}
              max={999}
              value={form.capacity}
              onChange={(e) => set("capacity", Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full h-10 px-3.5 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white focus:outline-none focus:border-[#333] transition-colors"
            />
          </div>

          {/* Recurring */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => set("is_recurring", !form.is_recurring)}
              className={cn(
                "h-5 w-5 rounded-md border-2 grid place-items-center transition-all",
                form.is_recurring ? "bg-white border-white" : "border-[#333]",
              )}
            >
              {form.is_recurring && (
                <svg className="h-3 w-3 text-black" fill="none" viewBox="0 0 12 12">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm text-white font-medium">Recurring weekly</p>
              <p className="text-xs text-[#999]">This class repeats every week</p>
            </div>
          </label>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#141414] flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-[#1f1f1f] text-sm text-[#999] hover:text-white hover:border-[#2a2a2a] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={pending || !form.title.trim()}
            className="h-9 px-5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {editing ? "Save Changes" : "Create Class"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete Confirm Dialog
// ─────────────────────────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  cls,
  onClose,
}: {
  cls: ClassRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteClass(cls.id);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Class deleted");
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-white">Delete class?</h2>
          <p className="text-sm text-[#666]">
            <span className="text-white font-medium">{cls.title}</span> and all its bookings will be permanently deleted.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-[#1f1f1f] text-sm text-[#777] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={pending}
            className="h-9 px-5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-400 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ScheduleView
// ─────────────────────────────────────────────────────────────────────────────

export function ScheduleView({
  gymId,
  classes,
}: {
  gymId: string;
  classes: ClassRow[];
}) {
  const router = useRouter();
  const [view, setView] = useState<"list" | "grid">("list");
  const [addForDay, setAddForDay] = useState<number | null>(null);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);

  const todayDow = new Date().getDay();
  const totalClasses = classes.length;
  const totalBookings = classes.reduce((s, c) => s + c.booking_count, 0);

  const byDay = DAYS.reduce<Record<number, ClassRow[]>>((acc, d) => {
    acc[d.value] = classes.filter((c) => c.day_of_week === d.value);
    return acc;
  }, {});

  const daysWithClasses = DAYS.filter((d) => (byDay[d.value]?.length ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <CalendarDays className="h-6 w-6 text-[#999]" />
            Schedule
          </h1>
          <p className="text-sm text-[#999] mt-0.5">
            {totalClasses} class{totalClasses !== 1 ? "es" : ""} · {totalBookings} booking{totalBookings !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* List / Grid toggle */}
          <div className="flex items-center rounded-xl border border-[#1f1f1f] p-1 bg-[#080808] gap-0.5">
            <button
              onClick={() => setView("list")}
              className={cn(
                "h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1.5",
                view === "list" ? "bg-white text-black shadow-sm" : "text-[#888] hover:text-white",
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              List
            </button>
            <button
              onClick={() => setView("grid")}
              className={cn(
                "h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-all inline-flex items-center gap-1.5",
                view === "grid" ? "bg-white text-black shadow-sm" : "text-[#888] hover:text-white",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
          </div>
          <button
            onClick={() => router.refresh()}
            className="h-9 w-9 grid place-items-center rounded-xl border border-[#1f1f1f] text-[#777] hover:text-white hover:border-[#2a2a2a] transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={() => setAddForDay(1)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            Add Class
          </button>
        </div>
      </div>

      {/* ── List view ── */}
      {view === "list" && (
        <div className="space-y-4">
          {daysWithClasses.map((day) => {
            const dayCls = byDay[day.value] ?? [];
            const isToday = day.value === todayDow;
            return (
              <div key={day.value}>
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
                    <span className={cn("text-sm font-bold", isToday ? "text-white" : "text-[#aaa]")}>
                      {day.label}
                    </span>
                    {isToday && (
                      <span className="ml-2 text-[10px] bg-white/10 text-white/60 rounded-full px-2 py-0.5">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-[#999] tabular-nums">
                    {dayCls.length} class{dayCls.length !== 1 ? "es" : ""}
                  </span>
                  <button
                    onClick={() => setAddForDay(day.value)}
                    className="h-7 px-3 rounded-xl border border-dashed border-[#1a1a1a] text-[11px] text-[#777] hover:text-white hover:border-[#333] transition-colors inline-flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                <div className="rounded-2xl border border-[#1a1a1a] bg-[#080808] overflow-hidden">
                  {dayCls.map((cls) => (
                    <ClassListItem
                      key={cls.id}
                      cls={cls}
                      onEdit={(c) => setEditing(c)}
                      onDelete={(c) => setDeleting(c)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {totalClasses === 0 && (
            <div className="rounded-2xl border border-dashed border-[#1a1a1a] py-16 flex flex-col items-center gap-3">
              <CalendarDays className="h-8 w-8 text-[#666]" />
              <div className="text-center">
                <p className="text-sm font-semibold text-white">No classes yet</p>
                <p className="text-xs text-[#999] mt-0.5">Add your first class to get started</p>
              </div>
              <button
                onClick={() => setAddForDay(1)}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 transition-all"
              >
                <Plus className="h-4 w-4" /> Add Class
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Grid view ── */}
      {view === "grid" && (
        <div className="overflow-x-auto -mx-1">
          <div className="grid grid-cols-7 gap-2 min-w-[700px] px-1">
            {DAYS.map((day) => {
              const dayCls = byDay[day.value] ?? [];
              return (
                <div key={day.value} className="flex flex-col gap-2">
                  {/* Day header */}
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-[#aaa] uppercase tracking-wider">
                      {day.short}
                    </span>
                    {dayCls.length > 0 && (
                      <span className="text-[10px] text-[#777] font-medium">
                        {dayCls.length}
                      </span>
                    )}
                  </div>

                  {/* Class cards */}
                  {dayCls.map((cls) => (
                    <ClassCard
                      key={cls.id}
                      cls={cls}
                      onEdit={(c) => setEditing(c)}
                      onDelete={(c) => setDeleting(c)}
                    />
                  ))}

                  {/* Add to this day */}
                  <button
                    onClick={() => setAddForDay(day.value)}
                    className="rounded-xl border border-dashed border-[#1a1a1a] py-3 text-[#777] hover:text-white hover:border-[#333] transition-colors flex items-center justify-center"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogs */}
      {(addForDay !== null || editing !== null) && (
        <ClassFormDialog
          editing={editing}
          defaultDay={addForDay ?? editing?.day_of_week ?? 1}
          onClose={() => { setAddForDay(null); setEditing(null); }}
        />
      )}
      {deleting && (
        <DeleteConfirmDialog
          cls={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
