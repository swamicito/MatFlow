"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, ArrowRight, CheckCircle2 } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  no_student:    "No student account found for that email. Contact your gym to get set up.",
  no_user:       "Sign-in failed. Please try again.",
  missing_code:  "Invalid sign-in link — request a new one below.",
  session_error: "Session error. Please sign in again.",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = searchParams.get("error");
    if (key) setError(ERROR_MESSAGES[key] ?? `Sign-in error: ${key}`);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError("Email is required."); return; }
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authErr } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (authErr) {
      setError(authErr.message);
      setLoading(false);
    } else {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="h-16 w-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/25 grid place-items-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Check your email</h1>
            <p className="text-[#9CA3AF] text-sm mt-2 leading-relaxed">
              We sent a sign-in link to{" "}
              <span className="text-white font-medium">{email}</span>.
              Click it to access the student portal.
            </p>
          </div>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="text-xs text-[#9CA3AF] hover:text-white transition-colors"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo + heading */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <img src="/logo-full.png" alt="MatFlow" className="h-16 md:h-20 w-auto" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Student Portal</h1>
          <p className="text-[#9CA3AF] text-sm mt-2">Sign in with your email to get started</p>
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF] pointer-events-none" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoFocus
              autoComplete="email"
              className="w-full h-12 pl-11 pr-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-white text-sm placeholder:text-[#555] outline-none focus:border-[#374151] transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full h-12 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
              : <><ArrowRight className="h-4 w-4" /> Send Sign-in Link</>
            }
          </button>
        </form>

        <p className="text-center text-[11px] text-[#555] leading-relaxed">
          We will email you a magic link — no password needed.
          <br />Your email must match a student record at your gym.
        </p>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}