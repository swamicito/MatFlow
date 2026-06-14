"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";
import { loginAsPlatformAdmin } from "./actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await loginAsPlatformAdmin(secret);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/admin/gyms");
    });
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center space-y-3">
          <div className="h-14 w-14 rounded-2xl bg-[#0a0a0a] border border-[#1f1f1f] grid place-items-center mx-auto">
            <ShieldCheck className="h-7 w-7 text-[#444]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Platform Admin</h1>
            <p className="text-sm text-[#555] mt-1">MatFlow internal tooling</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Admin secret"
              autoFocus
              autoComplete="current-password"
              className="w-full h-12 px-4 pr-12 rounded-xl bg-[#0a0a0a] border border-[#1f1f1f] text-white placeholder:text-[#444] outline-none focus:border-[#333] transition-colors text-sm"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-white transition-colors"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center py-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending || !secret.trim()}
            className="w-full h-12 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Continue
          </button>
        </form>

        <p className="text-center text-[11px] text-[#333]">
          Set <code className="font-mono text-[#444]">PLATFORM_ADMIN_SECRET</code> env var to override the default secret.
        </p>

      </div>
    </div>
  );
}
