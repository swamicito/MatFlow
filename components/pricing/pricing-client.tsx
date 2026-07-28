"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { CheckCircle2, X, Loader2, ArrowRight, ChevronDown, Phone, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  createPlatformCheckoutSession,
  type PricingPlan,
  type BillingInterval,
  type SignupInfo,
} from "@/app/pricing/actions";

const CALENDLY_URL =
  "https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ3vZpZn2KfFf2T5-n933Jz0nwRP5EfBX_QqNxHMDucbImLK9zmihWmpGl6BzHkIs8TavmhqUjoV";

// ─── Plan definitions ─────────────────────────────────────────────────────────

type Plan = {
  key: PricingPlan;
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  annualTotal: number;
  popular?: boolean;
  features: string[];
  missing: string[];
};

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    tagline: "Perfect for gyms just getting started.",
    monthly: 69,
    annual: 55,
    annualTotal: 660,
    features: [
      "For very small gyms (< 150 members)",
      "Core features",
      "Email support",
    ],
    missing: [
      "Stripe billing & payments",
      "Automations",
      "Advanced reporting",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    tagline: "The complete system to run and grow your gym.",
    monthly: 119,
    annual: 95,
    annualTotal: 1140,
    popular: true,
    features: [
      "Everything in Starter",
      "Stripe billing + payments",
      "Automations",
      "Advanced reporting",
      "Priority support",
    ],
    missing: [],
  },
  {
    key: "growth",
    name: "Growth",
    tagline: "Built for bigger gyms with bigger goals.",
    monthly: 199,
    annual: 159,
    annualTotal: 1908,
    features: [
      "Everything in Pro",
      "Multi-location support",
      "Advanced permissions",
      "Dedicated onboarding",
      "VIP support",
    ],
    missing: [],
  },
];

const FAQS = [
  {
    q: "Do I need a credit card to start?",
    a: "No. You get 30 days completely free. We only ask for payment info when your trial ends and you choose to continue.",
  },
  {
    q: "What happens at the end of the 30-day trial?",
    a: "We'll email you a reminder 7 days before your trial ends. If you haven't added a payment method by then, your subscription is automatically cancelled — no surprise charges, ever. You can add a card and continue at any time before the trial expires.",
  },
  {
    q: "Can I switch plans later?",
    a: "Yes. You can upgrade or downgrade at any time from your billing settings. Charges are prorated automatically.",
  },
  {
    q: "What is the $399 onboarding fee and when is it charged?",
    a: "It's completely optional. We'll get everything set up the right way — import your data, configure your embed, and walk through the platform with you. It's waived automatically on annual plans, and also waived for warm leads who complete a short video testimonial.",
  },
  {
    q: "Is there a long-term contract?",
    a: "No contracts. Monthly plans are cancel-anytime. Annual plans are billed once per year and are non-refundable after 30 days.",
  },
  {
    q: "How do I get my existing students onto the platform?",
    a: "Our CSV import tool works with most scheduling platforms. If you add the onboarding package, our team handles the migration for you.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlanCard({
  plan,
  cycle,
  onSelect,
}: {
  plan: Plan;
  cycle: BillingInterval;
  onSelect: (plan: Plan, cycle: BillingInterval) => void;
}) {
  const price = cycle === "monthly" ? plan.monthly : plan.annual;

  // Annual plans get white-glove onboarding waived — show it as a bonus feature.
  const features =
    cycle === "annual" && plan.key !== "starter"
      ? [...plan.features, "White-glove onboarding ($399 value) — free"]
      : plan.features;

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-8 border transition-all ${
        plan.popular
          ? "border-white/25 bg-[#111111] shadow-[0_0_40px_-8px_rgba(255,255,255,0.06)]"
          : "border-[#1f1f1f] bg-[#0d0d0d]"
      }`}
    >
      {plan.popular && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-white px-3.5 py-1 text-[11px] font-bold uppercase tracking-widest text-black">
          Most Popular
        </span>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-bold text-white">{plan.name}</h3>
        <p className="mt-1 text-sm text-[#6B7280]">{plan.tagline}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-end gap-1">
          <span className="text-5xl font-extrabold tracking-tight text-white">
            ${price}
          </span>
          <span className="mb-1.5 text-[#6B7280]">/mo</span>
        </div>
        {cycle === "annual" ? (
          <p className="mt-1 text-xs text-[#6B7280]">
            Billed ${plan.annualTotal}/year
          </p>
        ) : (
          <p className="mt-1 text-xs text-[#6B7280]">Billed monthly</p>
        )}
      </div>

      <button
        onClick={() => onSelect(plan, cycle)}
        className={`mb-8 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all ${
          plan.popular
            ? "bg-white text-black hover:bg-white/90"
            : "border border-[#333] bg-[#1a1a1a] text-white hover:bg-[#222]"
        }`}
      >
        Start Free Trial
        <ArrowRight className="h-3.5 w-3.5" />
      </button>

      <ul className="flex flex-col gap-2.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-[#D1D5DB]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
            {f}
          </li>
        ))}
        {plan.missing.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-[#4B5563]">
            <X className="mt-0.5 h-4 w-4 shrink-0" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Interest capture modal ────────────────────────────────────────────────────

type ModalProps = {
  plan: Plan;
  cycle: BillingInterval;
  info: SignupInfo;
  onChange: (field: keyof SignupInfo, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  pending: boolean;
  error: string | null;
};

function InterestModal({ plan, cycle, info, onChange, onSubmit, onClose, pending, error }: ModalProps) {
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const price = cycle === "monthly" ? plan.monthly : plan.annual;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-[#555] hover:text-white hover:bg-[#111] transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Plan summary */}
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg border border-[#1f1f1f] bg-[#111] px-3 py-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#6B7280]">{plan.name}</p>
            <p className="text-lg font-extrabold text-white">${price}<span className="text-xs font-normal text-[#6B7280]">/mo</span></p>
          </div>
          <div>
            <h2 id="modal-title" className="text-base font-semibold text-white">
              Almost there — tell us about your gym
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              We&apos;ll set your account up within a few hours.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5" htmlFor="gym_name">
              Gym name
            </label>
            <input
              ref={firstRef}
              id="gym_name"
              type="text"
              required
              placeholder="e.g. Triangle BJJ"
              value={info.gymName}
              onChange={(e) => onChange("gymName", e.target.value)}
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-2.5 text-sm text-white placeholder-[#555] focus:border-[#444] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5" htmlFor="owner_name">
              Your full name
            </label>
            <input
              id="owner_name"
              type="text"
              required
              placeholder="e.g. Carlos Mendes"
              value={info.ownerName}
              onChange={(e) => onChange("ownerName", e.target.value)}
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-2.5 text-sm text-white placeholder-[#555] focus:border-[#444] focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#9CA3AF] mb-1.5" htmlFor="owner_email">
              Email address
            </label>
            <input
              id="owner_email"
              type="email"
              required
              placeholder="you@yourgym.com"
              value={info.ownerEmail}
              onChange={(e) => onChange("ownerEmail", e.target.value)}
              className="w-full rounded-xl border border-[#2a2a2a] bg-[#111] px-4 py-2.5 text-sm text-white placeholder-[#555] focus:border-[#444] focus:outline-none transition-colors"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-black transition-all hover:bg-white/90 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Continue to Stripe
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#555]">
            <Lock className="h-3 w-3" />
            <span>Secure checkout · No card required for 30-day trial</span>
          </div>
        </form>
      </div>
    </div>
  );
}

function FaqItem({
  item,
  open,
  onToggle,
}: {
  item: (typeof FAQS)[number];
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#1a1a1a]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-medium text-white">{item.q}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#6B7280] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <p className="pb-5 text-sm leading-relaxed text-[#9CA3AF]">{item.a}</p>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

const EMPTY_INFO: SignupInfo = { gymName: "", ownerName: "", ownerEmail: "" };

export function PricingClient() {
  const [cycle, setCycle] = useState<BillingInterval>("monthly");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // ── Interest capture modal state ────────────────────────────────────────────
  const [selectedPlan, setSelectedPlan] = useState<{ plan: Plan; cycle: BillingInterval } | null>(null);
  const [info, setInfo] = useState<SignupInfo>(EMPTY_INFO);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handlePlanSelect(plan: Plan, cycle: BillingInterval) {
    setSelectedPlan({ plan, cycle });
    setInfo(EMPTY_INFO);
    setFormError(null);
  }

  function handleModalClose() {
    if (pending) return;
    setSelectedPlan(null);
    setFormError(null);
  }

  function handleFieldChange(field: keyof SignupInfo, value: string) {
    setInfo((prev) => ({ ...prev, [field]: value }));
  }

  function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) return;

    const trimmed: SignupInfo = {
      gymName: info.gymName.trim(),
      ownerName: info.ownerName.trim(),
      ownerEmail: info.ownerEmail.trim(),
    };

    if (!trimmed.gymName || !trimmed.ownerName || !trimmed.ownerEmail) {
      setFormError("All three fields are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed.ownerEmail)) {
      setFormError("Please enter a valid email address.");
      return;
    }

    setFormError(null);
    startTransition(async () => {
      const result = await createPlatformCheckoutSession(
        selectedPlan.plan.key,
        selectedPlan.cycle,
        trimmed,
      );
      if (result && !result.ok) {
        setFormError(result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="w-full">
      {/* ── Interest capture modal ──────────────────────────────────────────── */}
      {selectedPlan && (
        <InterestModal
          plan={selectedPlan.plan}
          cycle={selectedPlan.cycle}
          info={info}
          onChange={handleFieldChange}
          onSubmit={handleCheckout}
          onClose={handleModalClose}
          pending={pending}
          error={formError}
        />
      )}

      {/* ── Billing toggle ─────────────────────────────────────────────────── */}
      <div className="mb-12 flex items-center justify-center gap-4">
        <span
          className={`text-sm font-medium transition-colors ${cycle === "monthly" ? "text-white" : "text-[#6B7280]"}`}
        >
          Monthly
        </span>
        <button
          onClick={() => setCycle((c) => (c === "monthly" ? "annual" : "monthly"))}
          className={`relative h-7 w-12 rounded-full border transition-colors ${
            cycle === "annual" ? "border-white/20 bg-white/10" : "border-[#333] bg-[#1a1a1a]"
          }`}
          aria-label="Toggle billing interval"
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
              cycle === "annual" ? "left-6" : "left-1"
            }`}
          />
        </button>
        <span
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${cycle === "annual" ? "text-white" : "text-[#6B7280]"}`}
        >
          Annual
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            Save 20%
          </span>
        </span>
      </div>

      {/* ── Pricing cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <PlanCard key={plan.key} plan={plan} cycle={cycle} onSelect={handlePlanSelect} />
        ))}
      </div>

      {/* ── Onboarding notice ────────────────────────────────────────────────  */}
      <div className="mt-8 rounded-xl border border-[#1f1f1f] bg-[#0d0d0d] p-5">
        <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
          <div className="shrink-0 rounded-lg border border-[#1f1f1f] bg-[#111] px-3 py-2 text-xs font-bold uppercase tracking-widest text-white">
            Optional
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              $399 one-time white-glove onboarding
            </p>
            <p className="mt-1 text-sm text-[#6B7280]">
              We&apos;ll get everything set up the right way so you can hit the
              ground running.{" "}
              <span className="font-medium text-emerald-400">
                Waived for annual plans or warm leads who do a video testimonial.
              </span>{" "}
              Not charged during your trial — you choose at the end.
            </p>
          </div>
        </div>
      </div>

      {/* ── Strategy call ────────────────────────────────────────────────────  */}
      <div className="mt-16 rounded-2xl border border-[#1f1f1f] bg-[#0d0d0d] p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[#1f1f1f] bg-[#111]">
          <Phone className="h-5 w-5 text-[#6B7280]" />
        </div>
        <h3 className="text-lg font-bold text-white">Need help with your marketing too?</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#6B7280]">
          We offer done-for-you gym websites, Google Ads management, and professional photo &amp;
          video production. Book a free 30-minute call to learn more.
        </p>
        <a
          href={CALENDLY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[#333] bg-[#1a1a1a] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#222]"
        >
          Book a Strategy Call
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────────────  */}
      <div className="mt-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">
          Frequently asked questions
        </h2>
        <div className="mx-auto max-w-2xl">
          {FAQS.map((item, i) => (
            <FaqItem
              key={i}
              item={item}
              open={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
