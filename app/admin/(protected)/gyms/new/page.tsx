"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, Plus, Loader2, Building2, RefreshCw,
  Ban, Globe, Hash, MapPin, X, CreditCard, CalendarDays,
  FileText, Users, ArrowRight,
} from "lucide-react";
import { createGymWithSeed, adminSwitchGym, checkSlugAvailable } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
  "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney",
];

const PLAN_PREVIEW = [
  { name: "Monthly Unlimited", display: "$150/mo" },
  { name: "3× Per Week",       display: "$100/mo" },
  { name: "Kids Program",      display: "$100/mo" },
  { name: "Foundations",       display: "$120/mo" },
  { name: "Drop-In Pass",      display: "$30/wk"  },
] as const;

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONES.includes(tz) ? tz : "America/New_York";
  } catch {
    return "America/New_York";
  }
}

type SuccessData = { id: string; name: string; slug: string; plansSeeded: number };
type SlugStatus = "idle" | "checking" | "available" | "taken";

const inputCls =
  "w-full h-12 px-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-white text-sm placeholder:text-[#555] outline-none focus:border-[#2a2a2a] transition-colors";

function Field({ label, children, hint, required, optional }: {
  label: string; children: React.ReactNode;
  hint?: string; required?: boolean; optional?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-[#ccc]">
          {label}
          {required && <span className="ml-1.5 text-[10px] text-red-400 uppercase tracking-wide">required</span>}
          {optional && <span className="ml-1.5 text-[10px] text-[#9CA3AF] uppercase tracking-wide">optional</span>}
        </label>
        {hint && <span className="text-[11px] text-[#9CA3AF]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ icon: Icon, label, value, mono = false }: {
  icon: React.ElementType; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Icon className="h-4 w-4 text-[#9CA3AF] shrink-0" />
      <span className="text-sm text-[#9CA3AF] flex-1">{label}</span>
      <span className={cn("text-sm text-[#aaa]", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

export default function NewGymPage() {
  const [submitting, startSubmit] = useTransition();
  const [enteringDest, setEnteringDest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [form, setForm] = useState({ name: "", slug: "", address: "", timezone: "America/New_York" });
  const slugTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-detect timezone after mount (safe from SSR hydration mismatch)
  useEffect(() => {
    setForm((p) => ({ ...p, timezone: detectTimezone() }));
  }, []);

  // Debounced slug availability check (600 ms)
  useEffect(() => {
    if (slugTimerRef.current) clearTimeout(slugTimerRef.current);
    if (!form.slug || form.slug.length < 2) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    slugTimerRef.current = setTimeout(async () => {
      try {
        const r = await checkSlugAvailable(form.slug);
        setSlugStatus(r.available ? "available" : "taken");
      } catch {
        setSlugStatus("idle");
      }
    }, 600);
    return () => { if (slugTimerRef.current) clearTimeout(slugTimerRef.current); };
  }, [form.slug]);

  function handleNameChange(v: string) {
    setForm((p) => ({ ...p, name: v, slug: slugEdited ? p.slug : slugify(v) }));
  }

  function handleSlugChange(v: string) {
    setSlugEdited(true);
    setForm((p) => ({ ...p, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "") }));
  }

  function handleResetSlug() {
    setSlugEdited(false);
    setForm((p) => ({ ...p, slug: slugify(p.name) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || submitting) return;
    if (slugStatus === "taken") { setError("That slug is already taken — choose another or reset it."); return; }
    setError(null);
    startSubmit(async () => {
      const r = await createGymWithSeed({
        name: form.name, slug: form.slug,
        address: form.address || null, timezone: form.timezone,
      });
      if (!r.ok) { setError(r.error); return; }
      setSuccess(r.data);
    });
  }

  async function handleEnterGymAt(dest: string) {
    if (!success || enteringDest) return;
    setEnteringDest(dest);
    const r = await adminSwitchGym(success.id);
    if (r.ok) {
      window.location.href = dest;
    } else {
      setEnteringDest(null);
      setError(r.error);
    }
  }

  function handleCreateAnother() {
    setSuccess(null);
    setError(null);
    setSlugEdited(false);
    setSlugStatus("idle");
    setForm({ name: "", slug: "", address: "", timezone: detectTimezone() });
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-lg mx-auto py-6 space-y-7">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/25 grid place-items-center mx-auto">
            <Check className="h-10 w-10 text-emerald-400" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">{success.name}</h1>
            <p className="text-[#9CA3AF] text-sm mt-1.5">
              Ready to go ·{" "}
              <span className="text-emerald-400">{success.plansSeeded} membership plans seeded</span>
            </p>
          </div>
        </div>

        {/* Seeded plans — clearly visible */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-emerald-500/15">
            <p className="text-sm font-semibold text-white">Seeded Membership Plans</p>
            <span className="text-xs text-emerald-400 font-medium">{success.plansSeeded} ready to use</span>
          </div>
          <div className="divide-y divide-emerald-500/10">
            {PLAN_PREVIEW.map((p) => (
              <div key={p.name} className="flex items-center gap-3 px-5 py-3">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="text-sm text-white flex-1">{p.name}</span>
                <span className="text-sm font-mono text-[#9CA3AF]">{p.display}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-emerald-500/15 px-5 py-3">
            <p className="text-xs text-[#9CA3AF]">
              Placeholders only — connect Stripe and adjust pricing in{" "}
              <span className="text-white">Settings → Plans</span>.
            </p>
          </div>
        </div>

        {/* Gym identity summary */}
        <div className="rounded-2xl border border-[#1a1a1a] bg-[#060606] overflow-hidden">
          <div className="divide-y divide-[#0e0e0e]">
            <Row icon={Hash}  label="Slug"     value={success.slug} mono />
            <Row icon={Globe} label="Timezone" value={form.timezone} />
            {form.address && <Row icon={MapPin} label="Address" value={form.address} />}
          </div>
          <div className="border-t border-[#111] px-5 py-3 flex items-center gap-2 text-[13px] text-[#9CA3AF]">
            <Ban className="h-3.5 w-3.5 text-[#555] shrink-0" />
            No waiver templates yet — add them in Settings → Waivers
          </div>
        </div>

        {/* Next Steps — quick-action cards */}
        <div className="space-y-3">
          <p className="text-[10px] font-medium text-[#9CA3AF] uppercase tracking-widest">
            Quick actions · click to enter the gym there
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {([
              { dest: "/settings/sell",    icon: CreditCard,   label: "Edit Plans",   desc: "Customize pricing & Stripe" },
              { dest: "/schedule",         icon: CalendarDays, label: "Add Classes",  desc: "Build your weekly schedule" },
              { dest: "/settings/waivers", icon: FileText,     label: "Add Waivers",  desc: "Set up required documents"  },
              { dest: "/students",         icon: Users,        label: "Add Students", desc: "Import or create profiles"  },
            ] as const).map(({ dest, icon: Icon, label, desc }) => (
              <button
                key={dest}
                onClick={() => handleEnterGymAt(dest)}
                disabled={!!enteringDest}
                className="text-left p-4 rounded-xl border border-[#1a1a1a] bg-[#060606] hover:border-[#2a2a2a] hover:bg-[#0a0a0a] transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <Icon className="h-4 w-4 text-[#9CA3AF] group-hover:text-white transition-colors" />
                  {enteringDest === dest
                    ? <Loader2 className="h-3.5 w-3.5 text-[#9CA3AF] animate-spin" />
                    : <ArrowRight className="h-3.5 w-3.5 text-[#555] group-hover:text-[#9CA3AF] transition-colors" />
                  }
                </div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Primary actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleEnterGymAt("/dashboard")}
            disabled={!!enteringDest}
            className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {enteringDest === "/dashboard"
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Entering…</>
              : <><Building2 className="h-5 w-5" /> Enter gym dashboard</>
            }
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleCreateAnother}
              disabled={!!enteringDest}
              className="flex-1 h-11 rounded-2xl border border-[#1a1a1a] text-[#9CA3AF] text-sm font-medium hover:text-white hover:border-[#2a2a2a] transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              Create another
            </button>
            <Link
              href="/admin/gyms"
              className="flex-1 h-11 flex items-center justify-center text-sm text-[#9CA3AF] border border-[#1a1a1a] hover:border-[#2a2a2a] hover:text-white rounded-2xl transition-colors"
            >
              All gyms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  const submitBlocked = submitting || !form.name.trim() || slugStatus === "taken" || slugStatus === "checking";

  return (
    <div className="max-w-lg space-y-8">

      <div className="flex items-center gap-4">
        <Link
          href="/admin/gyms"
          className="h-9 w-9 grid place-items-center rounded-xl border border-[#1a1a1a] text-[#555] hover:text-white hover:border-[#2a2a2a] transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Create New Gym</h1>
          <p className="text-sm text-[#555] mt-0.5">Pre-seeded with plans and sane defaults. No waivers.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        <Field label="Gym Name" required>
          <input
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. Riverside BJJ"
            autoFocus
            className={inputCls}
          />
        </Field>

        <Field label="URL Slug" hint="Unique identifier · cannot be changed later">
          <div className="relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#333] pointer-events-none" />
            <input
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="riverside-bjj"
              className={cn(inputCls, "pl-9 pr-28")}
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {slugStatus === "checking" && (
                <Loader2 className="h-3.5 w-3.5 text-[#555] animate-spin" />
              )}
              {slugStatus === "available" && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium">
                  <Check className="h-3 w-3" strokeWidth={3} /> Available
                </span>
              )}
              {slugStatus === "taken" && (
                <span className="flex items-center gap-1 text-[11px] text-red-400 font-medium">
                  <X className="h-3 w-3" strokeWidth={3} /> Taken
                </span>
              )}
              {slugEdited && form.name && slugStatus !== "checking" && (
                <button
                  type="button"
                  onClick={handleResetSlug}
                  title="Reset to auto-generated slug"
                  className="ml-0.5 p-1 text-[#444] hover:text-white transition-colors rounded"
                >
                  <RefreshCw className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </Field>

        <Field label="Address / City / State" optional>
          <input
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            placeholder="123 Main St, Asbury Park, NJ"
            className={inputCls}
          />
        </Field>

        <Field label="Timezone" hint="Auto-detected from your browser">
          <select
            value={form.timezone}
            onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
            className={cn(inputCls, "appearance-none cursor-pointer")}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} className="bg-black">{tz}</option>
            ))}
          </select>
        </Field>

        {/* What gets seeded */}
        <div className="rounded-xl border border-[#1a1a1a] bg-[#060606] p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-[#9CA3AF]">Auto-seeded on creation</p>
          <ul className="space-y-2 text-[13px] text-[#9CA3AF]">
            <li className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span><span className="text-white">5 membership plans</span> — Monthly Unlimited, 3× Week, Kids, Foundations, Drop-In</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span><span className="text-white">Belt rank system</span> — White through Black (built-in enum)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
              <span><span className="text-white">Free class nudge</span> set to 3 visits · Onboarding wizard skipped</span>
            </li>
            <li className="flex items-start gap-2">
              <Ban className="h-3.5 w-3.5 text-[#555] mt-0.5 shrink-0" />
              <span>No waiver templates — add in Settings → Waivers</span>
            </li>
          </ul>
        </div>

        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitBlocked}
          className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {submitting
            ? <><Loader2 className="h-5 w-5 animate-spin" /> Creating…</>
            : slugStatus === "checking"
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Checking slug…</>
              : <><Plus className="h-5 w-5" /> Create Gym</>}
        </button>

      </form>
    </div>
  );
}
