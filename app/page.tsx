import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  CreditCard,
  LayoutDashboard,
  Star,
  Users,
  Zap,
} from "lucide-react";
import { Navbar } from "@/components/marketing/navbar";
import { FaqAccordion } from "@/components/marketing/faq-accordion";

// ─────────────────────────────────────────────────────────────────────────────
// TODO: Replace this with your real VSL YouTube video ID before going live.
// Example: "dQw4w9WgXcQ"  →  https://www.youtube.com/watch?v=dQw4w9WgXcQ
// ─────────────────────────────────────────────────────────────────────────────
const VSL_VIDEO_ID = "dQw4w9WgXcQ";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mat-flow.net";

export const metadata: Metadata = {
  title: "MatFlow — Gym Management for BJJ Academies",
  description:
    "Stop running your gym from DMs. MatFlow gives BJJ academies class scheduling, student sign-ups, Stripe payments, and a beautiful embeddable schedule — in one platform.",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    url: SITE_URL,
    title: "MatFlow — Gym Management for BJJ Academies",
    description:
      "Stop running your gym from DMs. MatFlow gives BJJ academies class scheduling, student sign-ups, Stripe payments, and a beautiful embeddable schedule — in one platform.",
  },
};

// ── JSON-LD schema ───────────────────────────────────────────────────────────

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "MatFlow",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo-full.png`,
        width: 400,
        height: 100,
      },
      description:
        "MatFlow is the all-in-one gym management platform for BJJ and martial arts academies.",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "MatFlow",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: "MatFlow",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "All-in-one gym management and class scheduling platform for martial arts academies. Features include embeddable class schedules, student self-service sign-ups, real-time capacity tracking, Stripe billing, and a coach dashboard.",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free to start. Paid plans available.",
      },
      publisher: { "@id": `${SITE_URL}/#organization` },
      featureList: [
        "Embeddable class schedule for any website",
        "Real-time capacity and spot tracking",
        "Student self-service sign-ups",
        "Stripe membership billing",
        "Coach and admin dashboard",
        "Automated class reminders",
        "Multi-gym support",
      ],
    },
  ],
};

// ── Data ─────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Code2,
    title: "Embed Your Schedule Anywhere",
    description:
      "Two lines of code puts your live class schedule on Webflow, Squarespace, Wix, WordPress — any site. Auto-resizes, stays up to date.",
  },
  {
    icon: BookOpen,
    title: "Rich Class Descriptions",
    description:
      "Add photos, instructor bios, videos, and custom links to any class. Students know exactly what to expect before they walk in.",
  },
  {
    icon: Users,
    title: "Real-Time Capacity",
    description:
      "Students see exactly how many spots remain. Classes close automatically when full. No double-booking, no surprises.",
  },
  {
    icon: CreditCard,
    title: "Stripe Payments Built In",
    description:
      "Accept membership plans, drop-ins, and class packs online. Recurring billing, clean invoices, and revenue dashboards included.",
  },
  {
    icon: LayoutDashboard,
    title: "Powerful Coach Dashboard",
    description:
      "Full visibility into your roster, attendance, payments, and belt progress — all in one fast, clean admin interface.",
  },
  {
    icon: Zap,
    title: "Automation & Reminders",
    description:
      "Automated SMS + email for new leads, class reminders, no-shows, and quiet students. Configurable rules, zero manual effort.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Create Your Gym",
    description:
      "Sign up and configure your classes, instructors, and membership plans in under 20 minutes.",
  },
  {
    number: "02",
    title: "Embed Your Schedule",
    description:
      "Paste two lines of code on your website. Your live schedule appears, branded to your gym.",
  },
  {
    number: "03",
    title: "Students Self-Serve",
    description:
      "Students sign up, pay, and manage memberships — all without texting you.",
  },
  {
    number: "04",
    title: "Focus on Teaching",
    description:
      "Spend your energy on the mat, not on admin. MatFlow runs the back office.",
  },
];

const PAIN_POINTS = [
  "Students texting you to ask \"is there class today?\"",
  "A Google Sheet that nobody remembers to update",
  "No-shows you only find out about the day of",
  "Chasing membership payments every single month",
  "Your schedule is a blurry JPEG pinned to Instagram",
  "No idea who's coming, who quit, or why",
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="bg-black text-white min-h-screen overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Navbar />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-4 text-center overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-white/[0.025] rounded-full blur-3xl" />
        </div>
        {/* Subtle grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative max-w-4xl mx-auto space-y-7">
          {/* Live badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#1f1f1f] bg-[#0a0a0a] text-xs text-[#9CA3AF]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Now live — free onboarding call for new gyms
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.25rem] font-bold tracking-tight leading-[1.06]">
            Stop Running Your Gym
            <br />
            <span className="text-[#6B7280]">From Your DMs</span>
          </h1>

          <p className="text-lg sm:text-xl text-[#6B7280] max-w-2xl mx-auto leading-relaxed">
            MatFlow is the all-in-one management platform for BJJ academies.
            Live scheduling, online sign-ups, Stripe payments, and a beautiful
            embeddable schedule for your website.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#video"
              className="inline-flex items-center gap-2 h-12 px-7 rounded-xl border border-[#222] text-[#9CA3AF] text-sm font-medium hover:border-[#333] hover:text-white transition-all"
            >
              Watch the Demo
            </a>
          </div>

          {/* Trust bar */}
          <p className="text-xs text-[#444] pt-2">
            Trusted by coaches at{" "}
            <span className="text-[#5a5a5a] font-medium">Method Jiu-Jitsu</span>
            ,{" "}
            <span className="text-[#5a5a5a] font-medium">Silva Fusion</span>,
            and growing academies worldwide.
          </p>
        </div>
      </section>

      {/* ── VIDEO SECTION ─────────────────────────────────────────────────── */}
      <section id="video" className="py-20 px-4">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#555]">
              Watch the Demo
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              See How MatFlow Works in 3 Minutes
            </h2>
            <p className="text-[#6B7280] max-w-xl mx-auto text-sm leading-relaxed">
              Watch a real gym owner set up their schedule, embed it on their
              website, and go from chaos to control in an afternoon.
            </p>
          </div>

          {/* TODO: Replace VSL_VIDEO_ID at the top of this file with your real YouTube video ID */}
          <div className="relative rounded-2xl overflow-hidden border border-[#1f1f1f] shadow-2xl shadow-black/80 bg-[#0a0a0a]">
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={`https://www.youtube.com/embed/${VSL_VIDEO_ID}?rel=0&modestbranding=1&color=white`}
                title="MatFlow Demo Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>

          {/* "In this video" bullets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {[
              "Set up your full schedule in under 20 minutes",
              "The two-line embed that puts your schedule on any website",
              "How students self-serve sign-ups without texting you",
              "Collecting membership payments automatically via Stripe",
              "The coach dashboard — full gym visibility in one place",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="text-sm text-[#9CA3AF]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-[#030303] border-y border-[#0d0d0d]">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-5">
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#555]">
                Sound familiar?
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
                Every BJJ gym owner
                <br />
                knows this chaos.
              </h2>
              <p className="text-[#6B7280] leading-relaxed text-sm">
                You built your academy to teach — not to manage spreadsheets,
                chase payments, and answer the same DMs week after week.
              </p>
              <a
                href="#video"
                className="inline-flex items-center gap-1.5 text-sm text-white hover:text-[#ccc] transition-colors"
              >
                There&apos;s a better way
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            <div className="space-y-2.5">
              {PAIN_POINTS.map((point, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#141414] bg-[#060606]"
                >
                  <span className="text-red-500/80 font-bold text-xs shrink-0">
                    ✕
                  </span>
                  <span className="text-sm text-[#9CA3AF]">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SOLUTION ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#555]">
            The Solution
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            One platform that handles everything.
          </h2>
          <p className="text-lg text-[#6B7280] leading-relaxed">
            MatFlow was purpose-built for martial arts academies. It replaces
            your spreadsheets, manual invoices, and text-based sign-ups with a
            clean, automated system your students will love.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-all"
          >
            Start Free Trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4 bg-[#030303] border-t border-[#0d0d0d]">
        <div className="max-w-6xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#555]">
              Everything You Need
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Built for how gyms actually operate.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  className="group p-6 rounded-2xl border border-[#161616] bg-[#060606] hover:border-[#242424] hover:bg-[#0a0a0a] transition-all duration-200 space-y-4"
                >
                  <div className="h-10 w-10 grid place-items-center rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] group-hover:border-[#2a2a2a] transition-colors">
                    <Icon className="h-5 w-5 text-[#bbb]" />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-base font-semibold text-white">
                      {f.title}
                    </h3>
                    <p className="text-sm text-[#6B7280] leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#555]">
              Simple Setup
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Live in an afternoon.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {STEPS.map((step, i) => (
              <div key={i} className="space-y-3">
                <span className="block text-5xl font-bold text-[#151515] leading-none font-mono tracking-tight select-none">
                  {step.number}
                </span>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ──────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-[#030303] border-t border-[#0d0d0d]">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#555]">
              Real Results
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Gyms are already moving faster.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Testimonial */}
            <div className="p-6 rounded-2xl border border-[#1a1a1a] bg-[#060606] space-y-5">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>
              <p className="text-[#ccc] text-sm leading-relaxed">
                &ldquo;MatFlow transformed how we run Method Jiu-Jitsu. Students
                sign up online, I can see who&apos;s coming, and membership payments
                run automatically. The schedule embed on our site looks
                incredible — our members love it.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#111] border border-[#1f1f1f] grid place-items-center text-sm font-bold text-[#ccc]">
                  C
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Coach Chris</p>
                  <p className="text-xs text-[#555]">Method Jiu-Jitsu</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="p-6 rounded-2xl border border-[#1a1a1a] bg-[#060606] flex flex-col justify-between gap-5">
              {[
                { stat: "< 20 min", label: "Average time from signup to live schedule" },
                { stat: "2 lines", label: "Of code to embed on any website" },
                { stat: "0 DMs", label: "For class sign-ups after going live" },
              ].map(({ stat, label }) => (
                <div key={stat} className="space-y-1">
                  <p className="text-3xl font-bold text-white tracking-tight">
                    {stat}
                  </p>
                  <p className="text-sm text-[#555]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-4">
        <div className="max-w-2xl mx-auto space-y-10">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#555]">
              FAQ
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">
              Questions? Answered.
            </h2>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────────────── */}
      <section className="py-28 px-4 relative overflow-hidden bg-[#030303] border-t border-[#0d0d0d]">
        <div className="absolute inset-0 pointer-events-none select-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-white/[0.025] rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-5xl font-bold text-white leading-tight">
            Ready to modernize
            <br />
            your gym?
          </h2>
          <p className="text-lg text-[#6B7280]">
            Join MatFlow today. Free to start, no credit card required.
            Your first schedule embed is live in minutes.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 h-12 px-8 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all"
          >
            Start Free Trial — It&apos;s Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-[#3a3a3a] pt-2">
            No credit card &bull; Cancel anytime &bull; Free onboarding call
            included
          </p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#0d0d0d] py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <img
            src="/logo-full.png"
            alt="MatFlow"
            className="h-7 w-auto opacity-50"
          />
          <nav className="flex items-center gap-6 text-xs text-[#444]">
            <Link href="/login" className="hover:text-[#888] transition-colors">
              Log in
            </Link>
            <a href="#features" className="hover:text-[#888] transition-colors">
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-[#888] transition-colors"
            >
              How It Works
            </a>
            <a href="#faq" className="hover:text-[#888] transition-colors">
              FAQ
            </a>
          </nav>
          <p className="text-[11px] text-[#2a2a2a]">
            © {new Date().getFullYear()} MatFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
