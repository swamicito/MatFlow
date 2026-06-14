"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Check, Plus, Loader2, Building2, RefreshCw,
  CreditCard, Layers, Clock, Ban,
} from "lucide-react";
import { createGymWithSeed, adminSwitchGym } from "@/app/admin/actions";

const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "America/Anchorage",
  "Pacific/Honolulu", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney",
];

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type SuccessData = { id: string; name: string; slug: string; plansSeeded: number };

const inputCls =
  "w-full h-12 px-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-white text-sm placeholder:text-[#333] outline-none focus:border-[#2a2a2a] transition-colors";

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
          {optional && <span className="ml-1.5 text-[10px] text-[#444] uppercase tracking-wide">optional</span>}
        </label>
        {hint && <span className="text-[11px] text-[#444]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value, mono = false }: {
  icon: React.ElementType; label: string; value: string; mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <Icon className="h-4 w-4 text-[#444] shrink-0" />
      <span className="text-sm text-[#666] flex-1">{label}</span>
      <span className={`text-sm text-[#aaa] ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

export default function NewGymPage() {
  const router = useRouter();
  const [submitting, startSubmit] = useTransition();
  const [entering, startEnter] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", address: "", timezone: "America/New_York" });

  function handleNameChange(v: string) {
    setForm((p) => ({ ...p, name: v, slug: slugEdited ? p.slug : slugify(v) }));
  }

  function handleSlugChange(v: string) {
    setSlugEdited(true);
    setForm((p) => ({ ...p, slug: v.toLowerCase().replace(/[^a-z0-9-]/g, "") }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError(null);
    startSubmit(async () => {
      const r = await createGymWithSeed({ name: form.name, slug: form.slug, address: form.address || null, timezone: form.timezone });
      if (!r.ok) { setError(r.error); return; }
      setSuccess(r.data);
    });
  }

  function handleEnterGym() {
    if (!success) return;
    startEnter(async () => {
      const r = await adminSwitchGym(success.id);
      if (r.ok) router.push("/dashboard");
    });
  }

  function handleCreateAnother() {
    setSuccess(null);
    setError(null);
    setSlugEdited(false);
    setForm({ name: "", slug: "", address: "", timezone: "America/New_York" });
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-md mx-auto py-6 space-y-8">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 grid place-items-center mx-auto">
            <Check className="h-8 w-8 text-emerald-400" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Gym created</h1>
            <p className="text-[#555] text-sm mt-1.5">
              <span className="text-white font-medium">{success.name}</span> is ready to go
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#1a1a1a] bg-[#060606] overflow-hidden divide-y divide-[#111]">
          <SummaryRow icon={Building2} label="Name"              value={success.name} />
          <SummaryRow icon={Building2} label="Slug"              value={success.slug} mono />
          <SummaryRow icon={CreditCard} label="Membership plans" value={`${success.plansSeeded} seeded`} />
          <SummaryRow icon={Layers}    label="Belt ranks"        value="White → Black (built-in)" />
          <SummaryRow icon={Clock}     label="Free class nudge"  value="After 3 visits" />
          <SummaryRow icon={Ban}       label="Waiver templates"  value="None — add manually in Settings" />
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleEnterGym}
            disabled={entering}
            className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {entering ? <Loader2 className="h-5 w-5 animate-spin" /> : <Building2 className="h-5 w-5" />}
            Enter this gym now
          </button>
          <button
            onClick={handleCreateAnother}
            className="w-full h-12 rounded-2xl border border-[#1a1a1a] text-[#888] text-sm font-medium hover:text-white hover:border-[#2a2a2a] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Create another gym
          </button>
          <Link
            href="/admin/gyms"
            className="w-full h-10 flex items-center justify-center text-sm text-[#444] hover:text-[#777] transition-colors"
          >
            Back to all gyms
          </Link>
        </div>
      </div>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
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

        <Field label="URL Slug" hint="Auto-generated · click to edit">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-[#333] select-none pointer-events-none font-mono">
              /gyms/
            </span>
            <input
              value={form.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="riverside-bjj"
              className={`${inputCls} pl-16`}
            />
            {slugEdited && form.name && (
              <button
                type="button"
                onClick={() => { setSlugEdited(false); setForm((p) => ({ ...p, slug: slugify(p.name) })); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 text-[11px] text-[#555] hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </button>
            )}
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

        <Field label="Timezone">
          <select
            value={form.timezone}
            onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
            className={`${inputCls} appearance-none cursor-pointer`}
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz} className="bg-black">{tz}</option>
            ))}
          </select>
        </Field>

        {/* What gets seeded */}
        <div className="rounded-xl border border-[#1a1a1a] bg-[#060606] p-4 space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-[#444]">Auto-seeded on creation</p>
          <ul className="space-y-2 text-[13px] text-[#666]">
            <li className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-[#333] mt-0.5 shrink-0" />
              <span><span className="text-[#999]">5 membership plans</span> — Monthly Unlimited, 3× Week, Kids, Foundations, Drop-In</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-[#333] mt-0.5 shrink-0" />
              <span><span className="text-[#999]">Belt rank system</span> — White through Black (built-in enum)</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="h-3.5 w-3.5 text-[#333] mt-0.5 shrink-0" />
              <span><span className="text-[#999]">Free class nudge</span> set to 3 visits · Onboarding wizard skipped</span>
            </li>
            <li className="flex items-start gap-2">
              <Ban className="h-3.5 w-3.5 text-[#2a2a2a] mt-0.5 shrink-0" />
              <span className="text-[#444]">No waiver templates — add them manually in Settings → Waivers</span>
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
          disabled={submitting || !form.name.trim()}
          className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
          Create Gym
        </button>

      </form>
    </div>
  );
}
