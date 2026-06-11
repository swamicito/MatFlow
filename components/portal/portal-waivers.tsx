"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileSignature,
  FileText,
  X,
} from "lucide-react";
import {
  SignaturePad,
  type SignaturePadHandle,
} from "@/components/students/signature-pad";
import { waiverTypeLabel, formatDate } from "@/lib/students";
import { savePortalWaiver } from "@/app/portal/actions";
import type { PortalWaiver, PortalWaiverTemplate } from "@/app/portal/actions";

export function PortalWaivers({
  templates,
  signedWaivers,
  studentName,
}: {
  templates: PortalWaiverTemplate[];
  signedWaivers: PortalWaiver[];
  studentName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [signingTemplate, setSigningTemplate] = useState<PortalWaiverTemplate | null>(null);
  const [signedByName, setSignedByName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingWaiver, setViewingWaiver] = useState<PortalWaiver | null>(null);
  const [showAllSigned, setShowAllSigned] = useState(false);

  const padRef = useRef<SignaturePadHandle>(null);

  const unsignedRequired = templates.filter((t) => t.required && !t.signed);
  const unsignedOptional = templates.filter((t) => !t.required && !t.signed);
  const signedTemplates = templates.filter((t) => t.signed);
  const visibleSigned = showAllSigned ? signedWaivers : signedWaivers.slice(0, 5);

  function openSign(t: PortalWaiverTemplate) {
    setError(null);
    setHasInk(false);
    setSignedByName("");
    setSigningTemplate(t);
    // Give DOM time to mount before clearing the pad
    setTimeout(() => padRef.current?.clear(), 50);
  }

  function closeSign() {
    setSigningTemplate(null);
    setError(null);
  }

  function onClear() {
    padRef.current?.clear();
  }

  function onSubmit() {
    if (!signingTemplate) return;
    setError(null);
    const dataUrl = padRef.current?.toDataURL();
    if (!dataUrl) {
      setError("Please sign before submitting.");
      return;
    }
    startTransition(async () => {
      const result = await savePortalWaiver({
        template_name: signingTemplate.name,
        signature_data: dataUrl,
        signed_by_name: signedByName || null,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSigningTemplate(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-8 pb-4">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Waivers</h1>
        <p className="text-sm text-[#888] mt-1">
          Review and sign required waivers before training.
        </p>
      </div>

      {/* ── Action Required ── */}
      {unsignedRequired.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wider">
              Action Required
            </h2>
          </div>
          <div className="space-y-2">
            {unsignedRequired.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-amber-300/80 mt-0.5">Required — not yet signed</p>
                </div>
                <button
                  onClick={() => openSign(t)}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white text-black text-sm font-medium px-4 py-2 hover:bg-white/90 active:scale-95 transition-all"
                >
                  <FileSignature className="h-4 w-4" />
                  Sign
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Optional unsigned templates ── */}
      {unsignedOptional.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-medium text-[#555] uppercase tracking-widest">
            Optional Waivers
          </h2>
          <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] divide-y divide-[#111] overflow-hidden">
            {unsignedOptional.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 text-[#555] shrink-0" />
                  <p className="text-sm text-white truncate">{t.name}</p>
                </div>
                <button
                  onClick={() => openSign(t)}
                  className="shrink-0 text-xs text-[#aaa] border border-[#333] rounded-lg px-3 py-1.5 hover:bg-[#111] hover:text-white active:scale-95 transition-all"
                >
                  Sign
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── All templates signed notice ── */}
      {templates.length > 0 && unsignedRequired.length === 0 && unsignedOptional.length === 0 && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center gap-3">
          <Check className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm text-white font-medium">All waivers signed</p>
            <p className="text-xs text-emerald-300/80 mt-0.5">
              You&apos;re all set. No action required.
            </p>
          </div>
        </div>
      )}

      {/* ── No templates at all ── */}
      {templates.length === 0 && (
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] py-12 flex flex-col items-center gap-3 text-center">
          <FileSignature className="h-8 w-8 text-[#444]" />
          <div>
            <p className="text-sm text-white">No waiver templates yet</p>
            <p className="text-xs text-[#555] mt-0.5">
              Your gym hasn&apos;t set up any waiver templates.
            </p>
          </div>
        </div>
      )}

      {/* ── Signed Waivers history ── */}
      {signedWaivers.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-[#555] uppercase tracking-widest">
              Signed Waivers
            </h2>
            <span className="text-xs text-[#444]">{signedWaivers.length} total</span>
          </div>

          <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] divide-y divide-[#111] overflow-hidden">
            {visibleSigned.map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-9 w-9 grid place-items-center rounded-lg border border-[#1f1f1f] bg-black shrink-0">
                  <Check className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">
                    {waiverTypeLabel(w.waiver_type)}
                  </p>
                  <p className="text-xs text-[#555]">
                    {formatDate(w.signed_at)}
                    {w.signed_by_name ? ` · ${w.signed_by_name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {w.signature_data && (
                    <button
                      onClick={() => setViewingWaiver(w)}
                      className="h-8 w-8 grid place-items-center rounded-lg border border-[#222] text-[#666] hover:text-white hover:bg-[#111] transition-colors"
                      title="View signature"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {w.pdf_url && (
                    <a
                      href={w.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="h-8 w-8 grid place-items-center rounded-lg border border-[#222] text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-colors"
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {signedWaivers.length > 5 && (
            <button
              onClick={() => setShowAllSigned((v) => !v)}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-[#666] hover:text-white py-2 transition-colors"
            >
              {showAllSigned ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" /> Show all {signedWaivers.length}
                </>
              )}
            </button>
          )}
        </section>
      )}

      {/* ── Sign Dialog (inline overlay) ── */}
      {signingTemplate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closeSign}
          />

          <div className="relative w-full sm:max-w-lg bg-[#0a0a0a] border border-[#1f1f1f] rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div>
              <h2 className="text-base font-semibold text-white">
                Sign: {signingTemplate.name}
              </h2>
              <p className="text-xs text-[#888] mt-0.5">
                Use your finger or stylus to sign in the box below.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#888]">
                Full name (optional — defaults to your account name)
              </label>
              <input
                type="text"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                placeholder={studentName}
                className="w-full rounded-lg border border-[#222] bg-black text-white text-sm px-3 py-2 placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-white/30"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#888]">Signature</span>
                <button
                  type="button"
                  onClick={onClear}
                  disabled={!hasInk}
                  className="text-xs text-[#666] hover:text-white disabled:opacity-30 transition-colors"
                >
                  Clear
                </button>
              </div>
              <SignaturePad
                ref={padRef}
                heightClassName="h-48"
                onInkChange={setHasInk}
              />
              <p className="text-[10px] text-[#555] leading-relaxed">
                By signing, I acknowledge the gym&apos;s waiver terms and
                assume responsibility for the risks of participation. This
                constitutes a legally binding electronic signature.
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-lg px-3 py-2 flex items-center gap-2">
                <X className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={closeSign}
                className="flex-1 rounded-xl border border-[#222] text-[#aaa] text-sm py-2.5 hover:bg-[#111] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onSubmit}
                disabled={pending || !hasInk}
                className="flex-1 rounded-xl bg-white text-black text-sm font-medium py-2.5 hover:bg-white/90 disabled:opacity-40 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                {pending ? "Saving…" : "Submit Signature"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Signature Modal ── */}
      {viewingWaiver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setViewingWaiver(null)}
          />
          <div className="relative w-full max-w-md bg-[#0a0a0a] border border-[#1f1f1f] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  {waiverTypeLabel(viewingWaiver.waiver_type)}
                </h2>
                <p className="text-xs text-[#888]">
                  Signed {formatDate(viewingWaiver.signed_at)}
                </p>
              </div>
              <button
                onClick={() => setViewingWaiver(null)}
                className="h-8 w-8 grid place-items-center rounded-lg border border-[#222] text-[#666] hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {viewingWaiver.signature_data ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={viewingWaiver.signature_data}
                alt="Your signature"
                className="w-full rounded-lg border border-[#222] bg-white"
              />
            ) : (
              <p className="text-sm text-[#888]">No signature image stored.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
