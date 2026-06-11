/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import { WAIVER_TYPE_LABEL } from "@/lib/students";
import { WaiversAdmin } from "@/components/waivers/waivers-admin";
import type { WaiverTemplateRow, SignedWaiverRow } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Digital Waivers · MatFlow" };

export default async function WaiversPage() {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) redirect("/settings");

  const gymId = await getCurrentGymId();
  const supabase = createAdminClient() as any;

  const templates: WaiverTemplateRow[] = [];
  const signedWaivers: SignedWaiverRow[] = [];

  if (gymId) {
    // ── Fetch all students for this gym (for name lookup + ID scoping) ──
    const { data: studentRows } = await supabase
      .from("students")
      .select("id, full_name")
      .eq("gym_id", gymId);

    const studentMap: Record<string, string> = {};
    (studentRows ?? []).forEach((s: { id: string; full_name: string }) => {
      studentMap[s.id] = s.full_name;
    });
    const studentIds = Object.keys(studentMap);

    // ── Fetch all signed waivers for this gym (scoped through students) ──
    const typeCounts: Record<string, number> = {};
    if (studentIds.length > 0) {
      const { data: waiverRows } = await supabase
        .from("waivers")
        .select("id, student_id, waiver_type, signed_at, signed_by_name, pdf_url")
        .in("student_id", studentIds)
        .order("signed_at", { ascending: false })
        .limit(500);

      (waiverRows ?? []).forEach((w: any) => {
        signedWaivers.push({
          id: w.id,
          student_id: w.student_id,
          student_name: studentMap[w.student_id] ?? "Unknown",
          waiver_type: w.waiver_type,
          signed_at: w.signed_at,
          signed_by_name: w.signed_by_name ?? null,
          pdf_url: w.pdf_url ?? null,
        });
        typeCounts[w.waiver_type] = (typeCounts[w.waiver_type] ?? 0) + 1;
      });
    }

    // ── Build reverse label map for smart type-count matching ──
    // e.g., "Liability Release" → "liability_release" → counts
    const reverseLabelMap: Record<string, string> = {};
    Object.entries(WAIVER_TYPE_LABEL).forEach(([key, label]) => {
      reverseLabelMap[label.toLowerCase()] = key;
    });

    // ── Fetch waiver templates ──
    const { data: tmplRows } = await supabase
      .from("waiver_templates")
      .select("*")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: true });

    (tmplRows ?? []).forEach((t: any) => {
      const typeKey = reverseLabelMap[t.name.toLowerCase()];
      const signedCount = typeKey
        ? (typeCounts[typeKey] ?? 0)
        : (typeCounts[t.name] ?? 0);
      templates.push({
        id: t.id,
        gym_id: t.gym_id,
        name: t.name,
        required: t.required,
        pdf_template_url: t.pdf_template_url ?? null,
        created_at: t.created_at,
        signed_count: signedCount,
      });
    });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <WaiversAdmin templates={templates} signedWaivers={signedWaivers} />
    </div>
  );
}
