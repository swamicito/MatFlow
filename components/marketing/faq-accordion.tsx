"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "Is MatFlow only for BJJ gyms?",
    a: "MatFlow is built with martial arts academies in mind, but it works for any class-based studio. The schedule embed, capacity management, and belt tracking features are especially popular with BJJ and MMA gyms.",
  },
  {
    q: "How long does setup take?",
    a: "Most gyms are live in under 20 minutes. Create your account, add your classes, then paste the two-line embed snippet on your website. That's it.",
  },
  {
    q: "Can students sign up without creating an account?",
    a: "The public schedule is visible to anyone with no login required. To reserve a spot, students sign in via a magic link — no passwords, no friction.",
  },
  {
    q: "Does the embed work on Webflow, Squarespace, and Wix?",
    a: "Yes. Any site that accepts custom HTML — Webflow, Squarespace, Wix, WordPress, Carrd, and more — works out of the box. Paste the two-line snippet into an Embed block and publish.",
  },
  {
    q: "How does pricing work?",
    a: "MatFlow offers a generous free tier. Paid plans unlock additional gyms, Stripe payment integrations, automation sequences, and priority support. No per-student fees ever.",
  },
  {
    q: "Is my data secure?",
    a: "All data lives in Supabase (PostgreSQL), fully isolated per gym, and encrypted in transit. Student data is never shared across gyms or used for advertising.",
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => (
        <div
          key={i}
          className="rounded-xl border border-[#1a1a1a] overflow-hidden bg-[#050505]"
        >
          <button
            className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#0a0a0a] transition-colors"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
          >
            <span className="text-sm font-medium text-white">{faq.q}</span>
            <ChevronDown
              className={`h-4 w-4 text-[#555] shrink-0 transition-transform duration-200 ${
                openIndex === i ? "rotate-180" : ""
              }`}
            />
          </button>

          {openIndex === i && (
            <div className="px-5 pb-5">
              <p className="text-sm text-[#9CA3AF] leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
