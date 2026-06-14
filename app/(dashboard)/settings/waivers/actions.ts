/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

export type WaiverTemplateRow = {
  id: string;
  gym_id: string;
  name: string;
  required: boolean;
  pdf_template_url: string | null;
  created_at: string;
  signed_count: number;
};

export type SignedWaiverRow = {
  id: string;
  student_id: string;
  student_name: string;
  waiver_type: string;
  signed_at: string;
  signed_by_name: string | null;
  pdf_url: string | null;
};

// ─────────────────── Create Template ───────────────────

export async function createWaiverTemplate(input: {
  name: string;
  required: boolean;
}): Promise<ActionResult<{ id: string }>> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) return { ok: false, error: "Permission denied." };
  if (!input.name?.trim()) return { ok: false, error: "Template name is required." };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym. Complete onboarding first." };

  const supabase = createAdminClient() as any;
  const { data, error } = await supabase
    .from("waiver_templates")
    .insert({
      gym_id: gymId,
      name: input.name.trim(),
      required: input.required,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create template." };
  }

  revalidatePath("/settings/waivers");
  return { ok: true, data: { id: data.id as string } };
}

// ─────────────────── Update Template ───────────────────

export async function updateWaiverTemplate(
  id: string,
  patch: {
    name?: string;
    required?: boolean;
    pdf_template_url?: string | null;
  },
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) return { ok: false, error: "Permission denied." };

  const supabase = createAdminClient() as any;

  // ── Ownership pre-check ────────────────────────────────────────────────────
  // Role check above only verifies the caller's permission level, not which
  // gym's template they're modifying.  Without this, an owner at gym A can
  // rename or toggle the `required` flag on a template belonging to gym B.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: owned } = await supabase
    .from("waiver_templates")
    .select("id")
    .eq("id", id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!owned) {
    return { ok: false, error: "Template not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name.trim();
  if (patch.required !== undefined) update.required = patch.required;
  if (patch.pdf_template_url !== undefined) update.pdf_template_url = patch.pdf_template_url;

  const { error } = await supabase
    .from("waiver_templates")
    .update(update)
    .eq("id", id)
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/waivers");
  return { ok: true };
}

// ─────────────────── Delete Template ───────────────────

export async function deleteWaiverTemplate(id: string): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) return { ok: false, error: "Permission denied." };

  const supabase = createAdminClient() as any;

  // ── Ownership pre-check ────────────────────────────────────────────────────
  // Waiver templates are legal-document configuration for a specific gym.
  // Deleting another gym's template removes their compliance setup and
  // invalidates any waiver flows referencing it — potentially an unrecoverable
  // data loss.  Both the pre-check and the scoped DELETE must pass.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: owned } = await supabase
    .from("waiver_templates")
    .select("id")
    .eq("id", id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!owned) {
    return { ok: false, error: "Template not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { error } = await supabase
    .from("waiver_templates")
    .delete()
    .eq("id", id)
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/waivers");
  return { ok: true };
}

// ─────────────────── Upload Template PDF ───────────────────

const TEMPLATE_BUCKET = "waiver-templates";

export async function uploadTemplatePdf(
  templateId: string,
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) return { ok: false, error: "Permission denied." };

  const file = formData.get("pdf") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file selected." };
  if (!file.type.includes("pdf")) return { ok: false, error: "Only PDF files are accepted." };
  if (file.size > 10_000_000) return { ok: false, error: "File must be under 10 MB." };

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const supabase = createAdminClient() as any;

  // ── Ownership pre-check ────────────────────────────────────────────────────
  // The previous version used gymId only to build the storage path, but never
  // verified that `templateId` belongs to `gymId`.  The split exploit:
  //   • Caller (gym A) supplies a templateId from gym B.
  //   • PDF uploads to gymA/{templateB_id}.pdf  (storage write to gym A).
  //   • DB update stamps gym B's template record with that URL.
  // Result: gym B's legal template PDF is silently replaced with gym A's file.
  // The pre-check closes this by ensuring the template row is owned by the
  // current gym before any storage or DB write proceeds.
  const { data: owned } = await supabase
    .from("waiver_templates")
    .select("id")
    .eq("id", templateId)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!owned) {
    return { ok: false, error: "Template not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  await supabase.storage.createBucket(TEMPLATE_BUCKET, { public: true }).catch(() => {});

  const path = `${gymId}/${templateId}.pdf`;
  const bytes = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });

  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { data: urlData } = supabase.storage.from(TEMPLATE_BUCKET).getPublicUrl(path);
  const url: string = (urlData?.publicUrl as string) ?? "";

  await supabase
    .from("waiver_templates")
    .update({ pdf_template_url: url })
    .eq("id", templateId)
    .eq("gym_id", gymId);

  revalidatePath("/settings/waivers");
  return { ok: true, data: { url } };
}
