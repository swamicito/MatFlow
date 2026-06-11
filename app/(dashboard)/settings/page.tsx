/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Database,
  FileSpreadsheet,
  Palette,
  Plus,
  Rocket,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingBag,
  Trophy,
  Video,
  Users,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can, type Permission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

type Tile = {
  href: string;
  title: string;
  description: string;
  icon: typeof SettingsIcon;
  cta: string;
  requires: Permission;
  highlight?: boolean;
};

const TILES: Tile[] = [
  {
    href: "/settings/branding",
    title: "Custom Branding",
    description:
      "Upload your gym logo and set brand colors. Your branding appears in the student portal — the owner dashboard always stays black & white.",
    icon: Palette,
    cta: "Customize branding",
    requires: "edit_settings",
  },
  {
    href: "/settings/import",
    title: "Import from Mindbody",
    description:
      "Drag-and-drop a CSV export. Auto-maps columns, lets you preview every row, then bulk-creates students, plans, memberships, and belt progress.",
    icon: FileSpreadsheet,
    cta: "Open importer",
    requires: "view_import",
    highlight: true,
  },
  {
    href: "/billing/plans",
    title: "Membership Plans",
    description:
      "Create and edit recurring plans. Stripe Products and Prices sync lazily on the next subscribe.",
    icon: Database,
    cta: "Manage plans",
    requires: "view_billing",
  },
  {
    href: "/students",
    title: "Students",
    description:
      "Roster, belt progression, family accounts, digital waivers, and per-student billing.",
    icon: Users,
    cta: "Open roster",
    requires: "view_students",
  },
  {
    href: "/settings/automation",
    title: "Automation",
    description:
      "Automated SMS + email sequences for new leads, no-shows, and quiet members.",
    icon: Zap,
    cta: "Configure rules",
    requires: "view_automation",
  },
  {
    href: "/settings/team",
    title: "Team & Roles",
    description:
      "Manage staff accounts and assign roles. Owner only.",
    icon: ShieldCheck,
    cta: "Manage team",
    requires: "view_team",
  },
  {
    href: "/settings/ondemand",
    title: "On-Demand Instructionals",
    description:
      "Upload and sell video lessons. Students purchase access and watch at their own pace. Track completion and watch history.",
    icon: Video,
    cta: "Manage videos",
    requires: "edit_ondemand",
  },
  {
    href: "/settings/sell",
    title: "Products & Sales",
    description:
      "Create drop-ins, class packs, private sessions, gift cards, and limited-time specials. Record manual sales and track revenue.",
    icon: ShoppingBag,
    cta: "Manage products",
    requires: "edit_shop",
  },
  {
    href: "/settings/challenges",
    title: "Challenges & Gamification",
    description:
      "Run time-limited training challenges, track leaderboards, and reward streaks. Students opt in from their profile.",
    icon: Trophy,
    cta: "Manage challenges",
    requires: "view_settings",
  },
  {
    href: "/onboarding",
    title: "Re-run Onboarding",
    description:
      "Step back through gym setup, plans, demo data, and webhook configuration.",
    icon: Rocket,
    cta: "Open wizard",
    requires: "view_onboarding",
  },
];

export default async function SettingsPage() {
  const role = await getCurrentRole();
  const tiles = TILES.filter((t) => can(role, t.requires));

  let gymCount = 0;
  if (can(role, "edit_settings")) {
    const admin = createAdminClient() as any;
    const { count } = await admin
      .from("gyms")
      .select("id", { count: "exact", head: true });
    gymCount = count ?? 0;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-[#aaa] mt-1">
          Academy profile, integrations, and one-time data migrations.
        </p>
      </header>

      {/* ── Manage Gyms — featured ── */}
      {can(role, "edit_settings") && (
        <section className="rounded-xl border border-[#1f1f1f] bg-[#0a0a0a] p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 grid place-items-center rounded-md border border-[#222] bg-black shrink-0">
              <Building2 className="h-5 w-5 text-[#ccc]" />
            </div>
            <div className="space-y-1.5 flex-1">
              <h2 className="text-base font-semibold text-white">Manage Gyms</h2>
              <p className="text-sm text-[#aaa]">
                Create additional locations, switch the active gym, and manage gym-level settings. Each gym&apos;s data is fully isolated.
              </p>
              <p className="text-sm text-white/70">
                You currently have{" "}
                <span className="font-semibold text-white">{gymCount}</span>{" "}
                gym{gymCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/settings/gym"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[#222] bg-black text-sm text-[#ccc] hover:text-white hover:border-[#333] transition-colors"
            >
              Manage gyms
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/settings/gym"
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add New Gym
            </Link>
          </div>

          <p className="text-xs text-[#444]">
            +$79/month per additional gym &bull; One-time setup $349
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className="group">
              <Card
                className={
                  "h-full bg-[#0a0a0a] border-[#1f1f1f] shadow-none transition-colors group-hover:border-[#333] " +
                  (t.highlight
                    ? "ring-1 ring-white/10 group-hover:ring-white/30"
                    : "")
                }
              >
                <CardContent className="p-6 flex flex-col h-full gap-4">
                  <div className="flex items-start justify-between">
                    <div
                      className={
                        "h-10 w-10 grid place-items-center rounded-md border " +
                        (t.highlight
                          ? "border-white/30 bg-white/5 text-white"
                          : "border-[#222] bg-black text-[#ccc]")
                      }
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {t.highlight && (
                      <span className="text-[10px] uppercase tracking-widest text-white/80 border border-white/30 rounded-full px-2 py-0.5">
                        Recommended first step
                      </span>
                    )}
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <h2 className="text-base font-semibold text-white">
                      {t.title}
                    </h2>
                    <p className="text-sm text-[#aaa] leading-relaxed">
                      {t.description}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 text-sm text-[#ccc] group-hover:text-white transition-colors">
                    {t.cta}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
