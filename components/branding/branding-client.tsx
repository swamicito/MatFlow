"use client";

import { useRef, useState, useTransition } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Home,
  Loader2,
  MessageSquare,
  Palette,
  ShoppingBag,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { updateBranding, uploadGymLogo } from "@/app/(dashboard)/settings/branding/actions";
import { Card, CardContent } from "@/components/ui/card";

// ─── helpers ───────────────────────────────────────────────────────────────

/** Pick a legible text color (black/white) for a given background hex. */
function contrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.55 ? "#000000" : "#ffffff";
}

// ─── Color picker ──────────────────────────────────────────────────────────

function ColorPicker({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-[#0f0f0f] last:border-0">
      <div className="min-w-0 flex-1 pr-4">
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-[11px] text-[#555] mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-[11px] font-mono text-[#555] tabular-nums">
          {value.toUpperCase()}
        </span>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-9 w-9 rounded-xl border-2 border-[#333] hover:border-[#555] transition-colors overflow-hidden shadow-md"
          style={{ background: value }}
          aria-label={`Pick ${label} color`}
        />
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
        />
      </div>
    </div>
  );
}

// ─── Live portal preview ────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: Home, label: "Home", active: true },
  { icon: CalendarDays, label: "Schedule", active: false },
  { icon: MessageSquare, label: "Messages", active: false },
  { icon: ShoppingBag, label: "Shop", active: false },
  { icon: CreditCard, label: "Billing", active: false },
];

function PortalPreview({
  logoUrl,
  gymName,
  primaryColor,
  secondaryColor,
  logoBgColor,
}: {
  logoUrl: string | null;
  gymName: string;
  primaryColor: string;
  secondaryColor: string;
  logoBgColor: string;
}) {
  const btnText = contrastColor(primaryColor);
  const displayName =
    gymName.length > 14 ? gymName.slice(0, 14) + "…" : gymName;

  return (
    <div className="w-[288px] rounded-2xl border border-[#1f1f1f] bg-black overflow-hidden shadow-2xl shadow-black/60 mx-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-[#111] bg-black/90">
        <div className="flex items-center gap-2.5">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden p-1"
            style={{ background: logoUrl ? logoBgColor : "#ffffff" }}
          >
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt="Gym logo"
                className="h-5 w-5 object-contain"
              />
            ) : (
              <span className="text-[11px] font-bold text-black">
                M
              </span>
            )}
          </div>
          <div>
            <div
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "#ffffff" }}
            >
              {displayName}
            </div>
            <div className="text-[8px] text-[#555]">Student Portal</div>
          </div>
        </div>
        <div className="h-5 w-5 rounded-full bg-[#1a1a1a] border border-[#2a2a2a]" />
      </div>

      {/* Body */}
      <div className="px-3.5 py-3.5 space-y-3">
        <div>
          <p className="text-[11px] font-bold text-white">Weekly Schedule</p>
          <p className="text-[9px] text-[#555] mt-0.5">3 classes available</p>
        </div>

        {/* Sample class card */}
        <div className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] overflow-hidden">
          <div className="p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-white">BJJ Fundamentals</p>
            <p className="text-[8px] text-[#555]">
              6:00 PM – 7:30 PM · Coach Alex
            </p>
            <span className="inline-flex items-center text-[8px] rounded-full px-1.5 py-0.5 bg-[#111] text-[#666] border border-[#1f1f1f]">
              12 spots left
            </span>
          </div>
          <div className="px-3 pb-3">
            <div
              className="w-full h-7 rounded-xl flex items-center justify-center text-[9px] font-bold transition-colors"
              style={{ background: primaryColor, color: btnText }}
            >
              Sign Up
            </div>
          </div>
        </div>

        {/* Booked card */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="p-3 space-y-1.5">
            <p className="text-[10px] font-bold text-white">No-Gi Advanced</p>
            <p className="text-[8px] text-[#555]">8:00 PM – 9:00 PM</p>
            <span className="inline-flex items-center gap-0.5 text-[8px] rounded-full px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Signed up
            </span>
          </div>
          <div className="px-3 pb-3">
            <div className="w-full h-6 rounded-lg border border-[#222] flex items-center justify-center text-[8px] text-[#555]">
              Cancel booking
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div className="flex items-stretch border-t border-[#111]">
        {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
          <div
            key={label}
            className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5"
            style={{ color: active ? primaryColor : "#333" }}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="text-[7px] font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function BrandingClient({
  gymName,
  initialLogoUrl,
  initialPrimaryColor,
  initialSecondaryColor,
  initialAccentColor,
  initialLogoBgColor,
}: {
  gymName: string;
  initialLogoUrl: string | null;
  initialPrimaryColor: string;
  initialSecondaryColor: string;
  initialAccentColor: string;
  initialLogoBgColor: string;
}) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor);
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [logoBgColor, setLogoBgColor] = useState(initialLogoBgColor);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pending, startTransition] = useTransition();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const hasChanges =
    primaryColor !== initialPrimaryColor ||
    secondaryColor !== initialSecondaryColor ||
    accentColor !== initialAccentColor ||
    logoBgColor !== initialLogoBgColor;

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append("logo", file);
    const result = await uploadGymLogo(fd);
    setUploadingLogo(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLogoUrl(result.data.url);
    toast.success("Logo uploaded successfully.");
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateBranding({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        logo_bg_color: logoBgColor,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Branding saved — students will see the update immediately.");
    });
  }

  function handleRemoveLogo() {
    startTransition(async () => {
      const result = await updateBranding({ logo_url: null });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLogoUrl(null);
      toast.success("Logo removed.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Custom Branding
        </h1>
        <p className="text-sm text-[#aaa] mt-1">
          Upload your gym&apos;s logo and set brand colors. Only the student
          portal shows custom branding — the owner dashboard stays black &amp;
          white.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        {/* ── Left: Settings ── */}
        <div className="space-y-5">
          {/* Logo */}
          <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
            <CardContent className="p-6 space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-[#555]">
                Logo
              </p>
              <div className="flex items-center gap-4">
                {/* Preview swatch — uses logoBgColor when a logo is uploaded */}
                <div
                  className="h-16 w-16 rounded-xl border border-[#222] flex items-center justify-center shrink-0 overflow-hidden p-2"
                  style={{ background: logoUrl ? logoBgColor : "#0f0f0f" }}
                >
                  {logoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={logoUrl}
                      alt="Gym logo"
                      className="h-11 w-11 object-contain"
                    />
                  ) : (
                    <span className="text-2xl font-bold text-[#2a2a2a]">M</span>
                  )}
                </div>

                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-white">
                    {logoUrl ? "Logo uploaded" : "No logo yet \u2014 using default \u201cM\u201d"}
                  </p>
                  <p className="text-xs text-[#555]">
                    PNG, JPG, WebP, or SVG · max 2 MB
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={uploadingLogo}
                      className={cn(
                        "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs transition-colors disabled:opacity-50",
                        "border-[#222] text-[#ccc] hover:text-white hover:border-[#333]",
                      )}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="h-3 w-3" />
                      )}
                      {logoUrl ? "Replace logo" : "Upload logo"}
                    </button>
                    {logoUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        disabled={pending}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#222] text-xs text-[#555] hover:text-red-400 hover:border-red-500/30 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Colors */}
          <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <Palette className="h-3.5 w-3.5 text-[#555]" />
                <p className="text-xs font-bold uppercase tracking-widest text-[#555]">
                  Brand Colors
                </p>
              </div>

              <ColorPicker
                label="Primary Color"
                description="Logo background · CTA buttons · active nav tab"
                value={primaryColor}
                onChange={setPrimaryColor}
              />
              <ColorPicker
                label="Secondary Color"
                description="Logo icon/text · button text on primary background"
                value={secondaryColor}
                onChange={setSecondaryColor}
              />
              <ColorPicker
                label="Accent Color"
                description="Subtle highlights and secondary badges"
                value={accentColor}
                onChange={setAccentColor}
              />
              <ColorPicker
                label="Logo Background"
                description="Background behind your logo in the portal header"
                value={logoBgColor}
                onChange={setLogoBgColor}
              />

              {/* Color swatch reference */}
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { label: "Primary", value: primaryColor },
                  { label: "Secondary", value: secondaryColor },
                  { label: "Accent", value: accentColor },
                  { label: "Logo BG", value: logoBgColor },
                ].map((c) => (
                  <div key={c.label} className="space-y-1.5">
                    <div
                      className="h-7 w-full rounded-lg border border-[#1a1a1a]"
                      style={{ background: c.value }}
                    />
                    <p className="text-[9px] text-[#444] text-center font-mono">
                      {c.value.toUpperCase()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Save row */}
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-[#444]">
              {hasChanges
                ? "You have unsaved color changes."
                : "All branding is up to date."}
            </p>
            <button
              type="button"
              onClick={handleSave}
              disabled={pending || !hasChanges}
              className={cn(
                "inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]",
                hasChanges && !pending
                  ? "bg-white text-black hover:bg-white/90"
                  : "bg-white/10 text-white/30 cursor-not-allowed",
              )}
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {pending ? "Saving…" : "Save Branding"}
            </button>
          </div>
        </div>

        {/* ── Right: Live preview ── */}
        <div className="space-y-4 lg:sticky lg:top-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[#555]">
            Live Preview
          </p>
          <PortalPreview
            logoUrl={logoUrl}
            gymName={gymName}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            logoBgColor={logoBgColor}
          />
          <p className="text-xs text-[#333] text-center">
            This is how students will see your portal.
          </p>
        </div>
      </div>
    </div>
  );
}
