"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-black/90 backdrop-blur-md border-b border-[#111]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <img src="/logo-full.png" alt="MatFlow" className="h-8 w-auto" />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-8">
          {(["#features", "#how-it-works", "#faq"] as const).map(
            (href, i) => (
              <a
                key={href}
                href={href}
                className="text-sm text-[#9CA3AF] hover:text-white transition-colors"
              >
                {["Features", "How It Works", "FAQ"][i]}
              </a>
            ),
          )}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-[#9CA3AF] hover:text-white transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
          >
            Get Started
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-1 text-[#9CA3AF] hover:text-white transition-colors"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden bg-black/95 backdrop-blur-md border-b border-[#111] px-6 pb-6">
          <nav className="flex flex-col gap-4 pt-5">
            {(["#features", "#how-it-works", "#faq"] as const).map(
              (href, i) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className="text-sm text-[#9CA3AF] hover:text-white transition-colors"
                >
                  {["Features", "How It Works", "FAQ"][i]}
                </a>
              ),
            )}
          </nav>
          <div className="flex flex-col gap-2 pt-5 mt-5 border-t border-[#111]">
            <Link
              href="/login"
              className="text-sm text-center text-[#9CA3AF] py-2 hover:text-white transition-colors"
              onClick={() => setOpen(false)}
            >
              Log in
            </Link>
            <Link
              href="/login"
              className="text-sm text-center font-semibold bg-white text-black rounded-xl py-3 hover:bg-white/90 transition-colors"
              onClick={() => setOpen(false)}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
