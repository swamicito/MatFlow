"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Copy,
  CreditCard,
  Database,
  ExternalLink,
  Globe,
  Loader2,
  PartyPopper,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  completeOnboarding,
  deleteOnboardingPlan,
  saveGymBasics,
  saveOnboardingPlans,
  testWebhook,
  type OnboardingState,
  type PlanDraft,
} from "@/app/onboarding/actions";
import {
  clearDemoData,
  loadDemoData,
} from "@/app/(dashboard)/dashboard/demo-actions";
import type { MembershipInterval } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const TOTAL_STEPS = 6;

const STEP_TITLES = [
  "Welcome",
  "Plans",
  "Import",
  "Demo",
  "Webhook",
  "Finish",
] as const;

const DEFAULT_PLAN_DRAFTS: PlanDraft[] = [
  {
    name: "Unlimited Adult",
    price_cents: 18900,
    interval: "month",
    description: "All adult classes, unlimited.",
  },
  {
    name: "Kids Program",
    price_cents: 12900,
    interval: "month",
    description: "Kids classes, twice weekly minimum.",
  },
  {
    name: "Family Plan",
    price_cents: 27900,
    interval: "month",
    description: "Up to 4 family members, unlimited.",
  },
  {
    name: "Trial 30-Day",
    price_cents: 4900,
    interval: "month",
    description: "30 days, all classes, one-time.",
  },
];

export function OnboardingWizard({
  initial,
  timezones,
}: {
  initial: OnboardingState;
  timezones: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();

  // ── Step 1 state ─────────────────────────
  const [gymName, setGymName] = useState(initial.gym.name);
  const [address, setAddress] = useState(initial.gym.address ?? "");
  const [phone, setPhone] = useState(initial.gym.phone ?? "");
  const [timezone, setTimezone] = useState(
    initial.gym.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      "America/New_York",
  );

  // ── Step 2 state ─────────────────────────
  const [plans, setPlans] = useState<PlanDraft[]>(() => {
    if (initial.plans.length > 0) {
      return initial.plans.map((p) => ({
        id: p.id,
        name: p.name,
        price_cents: p.price_cents,
        interval: p.interval,
        description: p.description,
      }));
    }
    return DEFAULT_PLAN_DRAFTS;
  });

  // ── Step 4 state ─────────────────────────
  const [demoLoaded, setDemoLoaded] = useState(initial.hasDemoData);

  // ── Step 5 state ─────────────────────────
  const [webhookTestedAt, setWebhookTestedAt] = useState<string | null>(
    initial.gym.webhook_last_test_at,
  );

  const webhookUrl = useMemo(() => {
    if (typeof window === "undefined") return "/api/webhook/webflow";
    return `${window.location.origin}/api/webhook/webflow`;
  }, []);

  // ── Step 6 confetti ──────────────────────
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => {
    if (step === 6) {
      setShowConfetti(true);
      const t = setTimeout(() => setShowConfetti(false), 4000);
      return () => clearTimeout(t);
    }
  }, [step]);

  // ─────────────────────────────────────────

  function next() {
    if (step < TOTAL_STEPS) setStep(step + 1);
  }
  function back() {
    if (step > 1) setStep(step - 1);
  }

  // ── Step 1 handler ────────────────────────
  function saveStep1AndContinue() {
    startTransition(async () => {
      const r = await saveGymBasics({
        name: gymName,
        address: address || null,
        phone: phone || null,
        timezone,
      });
      if (!r.ok) {
        toast.error("Couldn't save gym info", { description: r.error });
        return;
      }
      toast.success("Gym info saved");
      next();
    });
  }

  // ── Step 2 handlers ───────────────────────
  function updatePlan(idx: number, patch: Partial<PlanDraft>) {
    setPlans((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    );
  }
  function addPlan() {
    setPlans((prev) => [
      ...prev,
      {
        name: "",
        price_cents: 9900,
        interval: "month",
        description: null,
      },
    ]);
  }
  function removePlan(idx: number) {
    const target = plans[idx];
    setPlans((prev) => prev.filter((_, i) => i !== idx));
    if (target?.id) {
      startTransition(async () => {
        const r = await deleteOnboardingPlan(target.id!);
        if (!r.ok) {
          toast.error("Couldn't delete plan", { description: r.error });
          // re-add it locally so the UI stays consistent
          setPlans((prev) => [...prev, target]);
        }
      });
    }
  }
  function saveStep2AndContinue() {
    startTransition(async () => {
      const r = await saveOnboardingPlans(plans);
      if (!r.ok) {
        toast.error("Couldn't save plans", { description: r.error });
        return;
      }
      toast.success(
        `Plans saved · ${r.created} new, ${r.updated} updated`,
      );
      next();
    });
  }

  // ── Step 4 handlers ───────────────────────
  function loadDemo() {
    startTransition(async () => {
      const r = await loadDemoData();
      if (!r.ok) {
        toast.error("Couldn't load demo data", { description: r.error });
        return;
      }
      toast.success("Demo data loaded", {
        description: `${r.counts.students} students, ${r.counts.leads} leads, ${r.counts.memberships} memberships`,
        icon: <CheckCircle2 className="h-4 w-4" />,
      });
      setDemoLoaded(true);
    });
  }

  function clearDemo() {
    startTransition(async () => {
      const r = await clearDemoData();
      if (!r.ok) {
        toast.error("Couldn't clear demo data", { description: r.error });
        return;
      }
      toast.success("Demo data cleared");
      setDemoLoaded(false);
    });
  }

  // ── Step 5 handlers ───────────────────────
  function copyWebhookUrl() {
    navigator.clipboard.writeText(webhookUrl).then(
      () => toast.success("Webhook URL copied"),
      () => toast.error("Couldn't copy — please copy it manually"),
    );
  }
  function runWebhookTest() {
    startTransition(async () => {
      const r = await testWebhook();
      if (!r.ok) {
        toast.error("Webhook test failed", { description: r.error });
        return;
      }
      setWebhookTestedAt(new Date().toISOString());
      toast.success("Test lead created", {
        description: r.message,
      });
    });
  }

  // ── Finish ────────────────────────────────
  function finishOnboarding() {
    startTransition(async () => {
      const r = await completeOnboarding();
      if (!r.ok) {
        toast.error("Couldn't finish onboarding", { description: r.error });
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar step={step} />

      <div className="flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-2xl space-y-8">
          <ProgressHeader step={step} />

          {step === 1 && (
            <Step1
              gymName={gymName}
              setGymName={setGymName}
              address={address}
              setAddress={setAddress}
              phone={phone}
              setPhone={setPhone}
              timezone={timezone}
              setTimezone={setTimezone}
              timezones={timezones}
            />
          )}

          {step === 2 && (
            <Step2
              plans={plans}
              updatePlan={updatePlan}
              addPlan={addPlan}
              removePlan={removePlan}
            />
          )}

          {step === 3 && <Step3 />}

          {step === 4 && (
            <Step4
              loaded={demoLoaded}
              onLoad={loadDemo}
              onClear={clearDemo}
              pending={pending}
            />
          )}

          {step === 5 && (
            <Step5
              webhookUrl={webhookUrl}
              onCopy={copyWebhookUrl}
              onTest={runWebhookTest}
              testedAt={webhookTestedAt}
              pending={pending}
            />
          )}

          {step === 6 && (
            <Step6
              gymName={gymName}
              demoLoaded={demoLoaded}
              webhookTested={!!webhookTestedAt}
              planCount={plans.length}
            />
          )}

          <NavBar
            step={step}
            pending={pending}
            onBack={back}
            onSkip={
              step >= 3 && step <= 5
                ? () => next()
                : undefined
            }
            primary={
              step === 1
                ? { label: "Save & Continue", onClick: saveStep1AndContinue }
                : step === 2
                  ? { label: "Save Plans & Continue", onClick: saveStep2AndContinue }
                  : step === 6
                    ? {
                        label: "Go to Dashboard",
                        onClick: finishOnboarding,
                        icon: ArrowRight,
                      }
                    : { label: "Continue", onClick: next }
            }
          />
        </div>
      </div>

      {showConfetti && <Confetti />}
    </div>
  );
}

// ─────────────────── Top bar ───────────────────

function TopBar({ step }: { step: number }) {
  return (
    <div className="border-b border-[#1a1a1a] bg-black sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-white text-black grid place-items-center font-semibold text-xs">
            M
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            MatFlow
          </span>
          <span className="hidden sm:inline text-xs uppercase tracking-widest text-[#666] ml-2">
            Onboarding
          </span>
        </div>
        <div className="text-xs uppercase tracking-widest text-[#888]">
          Step {step} / {TOTAL_STEPS}
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Progress header ───────────────────

function ProgressHeader({ step }: { step: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const idx = i + 1;
          const done = idx < step;
          const active = idx === step;
          return (
            <div
              key={idx}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                done
                  ? "bg-emerald-500/70"
                  : active
                    ? "bg-white"
                    : "bg-[#1a1a1a]",
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[#666]">
        {STEP_TITLES.map((t, i) => (
          <span
            key={t}
            className={cn(
              "transition-colors",
              i + 1 === step && "text-white",
              i + 1 < step && "text-emerald-300/80",
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─────────────────── Step 1 ───────────────────

function Step1({
  gymName,
  setGymName,
  address,
  setAddress,
  phone,
  setPhone,
  timezone,
  setTimezone,
  timezones,
}: {
  gymName: string;
  setGymName: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  timezones: string[];
}) {
  return (
    <StepCard
      icon={Building2}
      eyebrow="Step 1 of 6"
      title="Welcome to MatFlow."
      description="Let's get your academy set up. We'll only ask the essentials — you can change everything later."
    >
      <div className="grid grid-cols-1 gap-5">
        <Field label="Gym Name" required>
          <Input
            value={gymName}
            onChange={(e) => setGymName(e.target.value)}
            placeholder="Asbury Park Jiu-Jitsu"
            className="bg-black border-[#222] text-white h-11"
          />
        </Field>
        <Field label="Address" hint="Street address shown on receipts.">
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Asbury Park, NJ 07712"
            className="bg-black border-[#222] text-white h-11"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(732) 555-0100"
              className="bg-black border-[#222] text-white h-11"
            />
          </Field>
          <Field label="Timezone" required>
            <Select
              value={timezone}
              onValueChange={(v) => v && setTimezone(v)}
            >
              <SelectTrigger className="bg-black border-[#222] text-white h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white max-h-72">
                {timezones.map((tz) => (
                  <SelectItem
                    key={tz}
                    value={tz}
                    className="focus:bg-[#111] focus:text-white"
                  >
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>
    </StepCard>
  );
}

// ─────────────────── Step 2 ───────────────────

function Step2({
  plans,
  updatePlan,
  addPlan,
  removePlan,
}: {
  plans: PlanDraft[];
  updatePlan: (idx: number, patch: Partial<PlanDraft>) => void;
  addPlan: () => void;
  removePlan: (idx: number) => void;
}) {
  return (
    <StepCard
      icon={CreditCard}
      eyebrow="Step 2 of 6"
      title="Create your first membership plans."
      description="We've pre-filled the most common plans for a BJJ academy. Edit prices and names to fit your gym."
    >
      <div className="space-y-3">
        {plans.map((p, idx) => (
          <PlanRow
            key={p.id ?? `new-${idx}`}
            plan={p}
            onChange={(patch) => updatePlan(idx, patch)}
            onRemove={() => removePlan(idx)}
            canRemove={plans.length > 1}
          />
        ))}
      </div>
      <div className="pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={addPlan}
          className="w-full h-11 border-dashed border-[#333] bg-transparent text-[#aaa] hover:bg-[#0a0a0a] hover:text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Another Plan
        </Button>
      </div>
    </StepCard>
  );
}

function PlanRow({
  plan,
  onChange,
  onRemove,
  canRemove,
}: {
  plan: PlanDraft;
  onChange: (patch: Partial<PlanDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const dollars = (plan.price_cents / 100).toFixed(2);
  return (
    <div className="rounded-md border border-[#1f1f1f] bg-black p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
        <Field label="Plan Name" compact>
          <Input
            value={plan.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Unlimited Adult"
            className="bg-[#0a0a0a] border-[#222] text-white h-10"
          />
        </Field>
        <Field label="Price (USD)" compact>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888]">
              $
            </span>
            <Input
              value={dollars}
              onChange={(e) => {
                const num = parseFloat(e.target.value);
                onChange({
                  price_cents: Number.isFinite(num)
                    ? Math.round(num * 100)
                    : 0,
                });
              }}
              type="number"
              step="0.01"
              min="0"
              className="bg-[#0a0a0a] border-[#222] text-white h-10 w-28 pl-7 tabular-nums"
            />
          </div>
        </Field>
        <Field label="Interval" compact>
          <Select
            value={plan.interval}
            onValueChange={(v) =>
              v && onChange({ interval: v as MembershipInterval })
            }
          >
            <SelectTrigger className="bg-[#0a0a0a] border-[#222] text-white h-10 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
              <SelectItem value="year">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label="Remove plan"
          className="h-10 w-10 text-[#666] hover:text-red-300 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <Input
        value={plan.description ?? ""}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Optional description shown on the checkout page"
        className="bg-[#0a0a0a] border-[#222] text-white h-9 text-sm"
      />
    </div>
  );
}

// ─────────────────── Step 3 ───────────────────

function Step3() {
  return (
    <StepCard
      icon={Upload}
      eyebrow="Step 3 of 6 · Optional"
      title="Bring your roster from Mindbody."
      description="If you're switching from Mindbody, MatFlow can import your current students, plans, and belt ranks from a CSV export. You can do this now or any time later from Settings."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href="/settings/import"
          target="_blank"
          rel="noopener noreferrer"
          className="group rounded-md border border-white/40 bg-white/5 hover:bg-white/10 transition-colors p-5"
        >
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-md bg-white text-black">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Import from Mindbody
              </p>
              <p className="text-xs text-[#aaa]">
                Drop a CSV, map columns, preview before importing.
              </p>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-1 text-xs text-[#ccc] group-hover:text-white">
            Open the importer
            <ExternalLink className="h-3 w-3" />
          </div>
        </a>

        <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 grid place-items-center rounded-md border border-[#222] bg-black text-[#ccc]">
              <ArrowRight className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Skip for now</p>
              <p className="text-xs text-[#aaa]">
                Add students manually or import later from Settings → Import.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-[#666] mt-5">
        Tip: open the importer in a new tab so you can keep this wizard open.
      </p>
    </StepCard>
  );
}

// ─────────────────── Step 4 ───────────────────

function Step4({
  loaded,
  onLoad,
  onClear,
  pending,
}: {
  loaded: boolean;
  onLoad: () => void;
  onClear: () => void;
  pending: boolean;
}) {
  return (
    <StepCard
      icon={Database}
      eyebrow="Step 4 of 6 · Recommended"
      title={loaded ? "Demo data is loaded." : "Want to see how MatFlow works?"}
      description={
        loaded
          ? "We've populated your workspace with a realistic Asbury Park roster. Explore Students, Leads, Billing, and Reports — clear it any time before going live."
          : "Load a realistic sample academy with 16 students, 4 families, 7 leads, and 4 plans. Perfect for exploring every screen before you add your own data."
      }
    >
      {loaded ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-5 flex items-start gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-md bg-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Demo workspace ready</p>
            <p className="text-xs text-[#aaa] mt-0.5">
              Tagged with <code>[DEMO DATA]</code> so you can find and remove
              every record in one click.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button
                variant="outline"
                onClick={onClear}
                disabled={pending}
                className="h-9 border-[#222] bg-transparent text-[#ccc] hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/40"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear demo data
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onLoad}
            disabled={pending}
            className="group text-left rounded-md border border-white/40 bg-white/5 hover:bg-white/10 transition-colors p-5 disabled:opacity-60"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 grid place-items-center rounded-md bg-white text-black">
                {pending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {pending ? "Loading demo data…" : "Load Demo Data"}
                </p>
                <p className="text-xs text-[#aaa]">
                  16 students, 4 families, 7 leads, 4 plans, belt progress.
                </p>
              </div>
            </div>
          </button>

          <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 grid place-items-center rounded-md border border-[#222] bg-black text-[#ccc]">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  I&apos;ll add real students later
                </p>
                <p className="text-xs text-[#aaa]">
                  Skip for now — you can load (or clear) demo data any time
                  from the Dashboard.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </StepCard>
  );
}

// ─────────────────── Step 5 ───────────────────

function Step5({
  webhookUrl,
  onCopy,
  onTest,
  testedAt,
  pending,
}: {
  webhookUrl: string;
  onCopy: () => void;
  onTest: () => void;
  testedAt: string | null;
  pending: boolean;
}) {
  return (
    <StepCard
      icon={Globe}
      eyebrow="Step 5 of 6 · Optional"
      title="Pipe leads in from your website."
      description="Point your Webflow form (or any form platform that supports webhooks) at this URL. Every submission lands in /leads instantly."
    >
      <div className="space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-widest text-[#888] mb-1.5 block">
            Webhook URL
          </Label>
          <div className="flex items-stretch gap-2">
            <code className="flex-1 min-w-0 truncate rounded-md border border-[#222] bg-black px-3 h-11 inline-flex items-center text-xs sm:text-sm font-mono text-white">
              {webhookUrl}
            </code>
            <Button
              type="button"
              variant="outline"
              onClick={onCopy}
              className="h-11 border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-[#1f1f1f] bg-[#0a0a0a] p-4 space-y-3">
          <p className="text-xs uppercase tracking-widest text-[#888]">
            How to wire it up in Webflow
          </p>
          <ol className="text-sm text-[#ccc] space-y-2 list-decimal pl-5">
            <li>Open your form&apos;s Settings panel.</li>
            <li>
              Set the <span className="text-white">Form Action</span> to the
              URL above.
            </li>
            <li>
              Make sure your form fields are named <code>name</code>,{" "}
              <code>email</code>, and (optional) <code>phone</code>.
            </li>
            <li>Publish your site and submit a real entry to verify.</li>
          </ol>
        </div>

        <div className="rounded-md border border-[#1f1f1f] bg-black p-4 flex items-start gap-3 flex-wrap">
          <div className="h-10 w-10 grid place-items-center rounded-md border border-[#222] bg-[#0a0a0a] text-white">
            <Webhook className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-[180px] space-y-0.5">
            <p className="text-sm font-semibold text-white">Send a test lead</p>
            <p className="text-xs text-[#aaa]">
              Inserts a synthetic lead so you can confirm the leads page is
              working.
            </p>
            {testedAt && (
              <p className="text-[11px] text-emerald-300 mt-1">
                Last test: {new Date(testedAt).toLocaleString()}
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={onTest}
            disabled={pending}
            variant="outline"
            className="border-[#222] bg-transparent text-[#ccc] hover:bg-[#111] hover:text-white h-10"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Webhook className="h-4 w-4 mr-2" />
            )}
            Test Webhook
          </Button>
        </div>
      </div>
    </StepCard>
  );
}

// ─────────────────── Step 6 ───────────────────

function Step6({
  gymName,
  demoLoaded,
  webhookTested,
  planCount,
}: {
  gymName: string;
  demoLoaded: boolean;
  webhookTested: boolean;
  planCount: number;
}) {
  const items: { label: string; done: boolean; meta?: string }[] = [
    { label: "Gym profile", done: !!gymName, meta: gymName || undefined },
    {
      label: "Membership plans",
      done: planCount > 0,
      meta: `${planCount} plan${planCount === 1 ? "" : "s"}`,
    },
    {
      label: "Sample data",
      done: demoLoaded,
      meta: demoLoaded ? "Loaded" : "Skipped",
    },
    {
      label: "Webhook integration",
      done: webhookTested,
      meta: webhookTested ? "Tested" : "Skipped",
    },
  ];

  return (
    <StepCard
      icon={PartyPopper}
      eyebrow="Step 6 of 6"
      title="You're all set."
      description="Your academy is configured. Click below to enter the dashboard — you can revisit any step from Settings."
    >
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.label}
            className="flex items-center justify-between rounded-md border border-[#1f1f1f] bg-black px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-7 w-7 grid place-items-center rounded-full border",
                  it.done
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-[#333] bg-[#0a0a0a] text-[#666]",
                )}
              >
                {it.done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#444]" />
                )}
              </div>
              <span className="text-sm text-white">{it.label}</span>
            </div>
            {it.meta && (
              <span className="text-xs uppercase tracking-widest text-[#888]">
                {it.meta}
              </span>
            )}
          </li>
        ))}
      </ul>
    </StepCard>
  );
}

// ─────────────────── Shared layout bits ───────────────────

function StepCard({
  icon: Icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
      <CardContent className="p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 grid place-items-center rounded-md bg-white text-black shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1.5 min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-[#666]">
              {eyebrow}
            </p>
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-white">
              {title}
            </h2>
            <p className="text-sm text-[#aaa] leading-relaxed">
              {description}
            </p>
          </div>
        </div>
        <div>{children}</div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  hint,
  required,
  compact,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      <Label className="text-xs uppercase tracking-widest text-[#888] flex items-center gap-1">
        {label}
        {required && <span className="text-white">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-[#666]">{hint}</p>}
    </div>
  );
}

function NavBar({
  step,
  pending,
  onBack,
  onSkip,
  primary,
}: {
  step: number;
  pending: boolean;
  onBack: () => void;
  onSkip?: () => void;
  primary: { label: string; onClick: () => void; icon?: typeof ArrowRight };
}) {
  const PrimaryIcon = primary.icon ?? ArrowRight;
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={step === 1 || pending}
        className="text-[#aaa] hover:text-white hover:bg-[#111]"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>
      <div className="flex items-center gap-2">
        {onSkip && (
          <Button
            type="button"
            variant="ghost"
            onClick={onSkip}
            disabled={pending}
            className="text-[#888] hover:text-white hover:bg-[#111]"
          >
            Skip
          </Button>
        )}
        <Button
          type="button"
          onClick={primary.onClick}
          disabled={pending}
          className="bg-white text-black hover:bg-white/90 h-11 px-5"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          {primary.label}
          <PrimaryIcon className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

// ─────────────────── Confetti ───────────────────

function Confetti() {
  // CSS-only confetti — no extra deps. ~40 dots fall from the top with
  // randomized hues (white & emerald to match the brand) and timings.
  const pieces = Array.from({ length: 42 });
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 1.2;
        const duration = 2.5 + Math.random() * 1.5;
        const size = 6 + Math.random() * 6;
        const isEmerald = Math.random() > 0.55;
        return (
          <span
            key={i}
            className="absolute top-[-20px] rounded-sm"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 0.4,
              background: isEmerald ? "rgb(110 231 183)" : "white",
              animation: `mf-fall ${duration}s linear ${delay}s forwards`,
              transform: `rotate(${Math.random() * 360}deg)`,
              opacity: 0.9,
            }}
          />
        );
      })}
      <style>{`
        @keyframes mf-fall {
          to {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
