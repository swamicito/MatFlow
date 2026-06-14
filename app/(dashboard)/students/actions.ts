/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import {
  ADULT_BELTS,
  STUDENT_STATUSES,
  WAIVER_TYPES,
  waiverTypeLabel,
  type WaiverType,
} from "@/lib/students";
import type { BeltRank, Database, StudentStatus } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };


// ───────────────────────── Create Student ─────────────────────────

export type CreateStudentInput = {
  full_name: string;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  belt_rank?: BeltRank;
  status?: StudentStatus;
  notes?: string | null;
};

export async function createStudent(
  input: CreateStudentInput,
): Promise<ActionResult<{ id: string; name: string }>> {
  if (!input.full_name?.trim()) {
    return { ok: false, error: "Full name is required." };
  }

  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym. Complete onboarding first." };

  const belt: BeltRank = input.belt_rank ?? "white";
  const status: StudentStatus = input.status ?? "active";

  const { data: student, error } = await supabase
    .from("students")
    .insert({
      gym_id: gymId,
      full_name: input.full_name.trim(),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      date_of_birth: input.date_of_birth || null,
      belt_rank: belt,
      status,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !student) {
    return { ok: false, error: error?.message ?? "Failed to create student." };
  }

  // Seed a belt_progress row so the tracker is ready on first open.
  await supabase
    .from("belt_progress")
    .upsert(
      {
        student_id: student.id,
        current_belt: belt,
        stripes: 0,
        skills_completed: [],
        progress_percentage: 0,
      },
      { onConflict: "student_id" },
    );

  revalidatePath("/students");
  return { ok: true, data: { id: student.id as string, name: input.full_name.trim() } };
}

// ───────────────────────── Update Belt Progress ─────────────────────────

export type UpdateBeltProgressInput = {
  student_id: string;
  current_belt: BeltRank;
  stripes: number;
  skills_completed: string[];
  progress_percentage: number;
};

export async function updateBeltProgress(
  input: UpdateBeltProgressInput,
): Promise<ActionResult> {
  if (!ADULT_BELTS.includes(input.current_belt)) {
    return { ok: false, error: "Invalid belt." };
  }
  if (input.stripes < 0 || input.stripes > 4) {
    return { ok: false, error: "Stripes must be between 0 and 4." };
  }

  const supabase = createAdminClient() as any;

  // ── Ownership pre-check ────────────────────────────────────────────────────
  // belt_progress has no gym_id column, so the only way to enforce gym
  // ownership is to verify the parent student row belongs to the current gym
  // before touching either table.  Without this, any caller who knows a
  // student UUID can overwrite belt data for students at other gyms.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: owned } = await supabase
    .from("students")
    .select("id")
    .eq("id", input.student_id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!owned) {
    return { ok: false, error: "Student not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Mirror the current belt to the student row so the table stays in sync.
  const { error: studentErr } = await supabase
    .from("students")
    .update({ belt_rank: input.current_belt })
    .eq("id", input.student_id)
    .eq("gym_id", gymId);
  if (studentErr) return { ok: false, error: studentErr.message };

  const { error } = await supabase.from("belt_progress").upsert(
    {
      student_id: input.student_id,
      current_belt: input.current_belt,
      stripes: input.stripes,
      skills_completed: input.skills_completed,
      progress_percentage: Math.max(
        0,
        Math.min(100, Math.round(input.progress_percentage)),
      ),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id" },
  );

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  return { ok: true };
}

// ───────────────────────── Update Student Info ─────────────────────────

export type UpdateStudentInput = {
  id: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  status?: StudentStatus;
  notes?: string | null;
};

export async function updateStudent(
  input: UpdateStudentInput,
): Promise<ActionResult> {
  if (input.status && !STUDENT_STATUSES.includes(input.status)) {
    return { ok: false, error: "Invalid status." };
  }

  const supabase = createAdminClient() as any;

  // ── Ownership pre-check ────────────────────────────────────────────────────
  // Without this, any caller with a student UUID can modify name, email,
  // phone, status, and notes for students at other gyms.  Changing `status`
  // to "inactive" gates portal access — a particularly destructive cross-gym
  // write.  The pre-check is an explicit hard block; the .eq("gym_id") on the
  // update itself is a second, independent guard at the DB layer.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: owned } = await supabase
    .from("students")
    .select("id")
    .eq("id", input.id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!owned) {
    return { ok: false, error: "Student not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const patch: Database["public"]["Tables"]["students"]["Update"] = {};
  if (input.full_name !== undefined) patch.full_name = input.full_name.trim();
  if (input.email !== undefined) patch.email = input.email?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;

  const { error } = await supabase
    .from("students")
    .update(patch)
    .eq("id", input.id)
    .eq("gym_id", gymId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  return { ok: true };
}

// ───────────────────────── Convert Lead → Student ─────────────────────────

export async function convertLeadToStudent(
  leadId: string,
  options: { family_account_id?: string | null } = {},
): Promise<ActionResult<{ student_id: string }>> {
  const supabase = createAdminClient() as any;

  // ── Ownership pre-check baked into the lead fetch ─────────────────────────
  // Without the gym_id filter, gym A's staff can convert any lead by UUID —
  // including leads from gym B.  The resulting student would be stamped with
  // gym B's gym_id (inherited from lead.gym_id), silently creating a student
  // record in a gym the caller has no access to.
  //
  // Fix: add .eq("gym_id", gymId) to the lead fetch so it returns null for
  // out-of-gym leads.  The student insert then uses gymId from the session
  // (not lead.gym_id) as the authoritative source of truth.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, name, email, phone, notes")
    .eq("id", leadId)
    .eq("gym_id", gymId)
    .maybeSingle();
  // ──────────────────────────────────────────────────────────────────────────

  if (leadErr) return { ok: false, error: leadErr.message };
  if (!lead) return { ok: false, error: "Lead not found or does not belong to this gym." };

  const { data: student, error: insertErr } = await supabase
    .from("students")
    .insert({
      gym_id: gymId,
      lead_id: lead.id,
      full_name: lead.name,
      email: lead.email,
      phone: lead.phone,
      notes: lead.notes,
      belt_rank: "white",
      status: "active",
      family_account_id: options.family_account_id ?? null,
    })
    .select("id")
    .single();

  if (insertErr || !student) {
    return {
      ok: false,
      error: insertErr?.message ?? "Failed to create student from lead.",
    };
  }

  // Seed belt_progress
  await supabase.from("belt_progress").upsert(
    {
      student_id: student.id,
      current_belt: "white",
      stripes: 0,
      skills_completed: [],
      progress_percentage: 0,
    },
    { onConflict: "student_id" },
  );

  // Mark the lead as converted — scoped to this gym as a second safety layer.
  await supabase
    .from("leads")
    .update({ status: "converted" })
    .eq("id", leadId)
    .eq("gym_id", gymId);

  revalidatePath("/students");
  revalidatePath("/leads");
  return { ok: true, data: { student_id: student.id } };
}

// ═══════════════════════════════════════════════════════════════════════════
// Family Accounts
// ═══════════════════════════════════════════════════════════════════════════

export type CreateFamilyInput = {
  parent_name: string;
  parent_email?: string | null;
  parent_phone?: string | null;
  shared_billing?: boolean;
  notes?: string | null;
  initial_member_ids?: string[];
};

export async function createFamily(
  input: CreateFamilyInput,
): Promise<ActionResult<{ family_id: string }>> {
  if (!input.parent_name?.trim()) {
    return { ok: false, error: "Family / parent name is required." };
  }
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym. Complete onboarding first." };

  const { data: family, error } = await supabase
    .from("family_accounts")
    .insert({
      gym_id: gymId,
      parent_name: input.parent_name.trim(),
      parent_email: input.parent_email?.trim() || null,
      parent_phone: input.parent_phone?.trim() || null,
      shared_billing: input.shared_billing ?? false,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !family) {
    return { ok: false, error: error?.message ?? "Failed to create family." };
  }

  if (input.initial_member_ids?.length) {
    await supabase
      .from("students")
      .update({ family_account_id: family.id })
      .in("id", input.initial_member_ids);
    // Promote the first member to head if no head set yet.
    await supabase
      .from("family_accounts")
      .update({ head_student_id: input.initial_member_ids[0] })
      .eq("id", family.id);
  }

  revalidatePath("/students");
  return { ok: true, data: { family_id: family.id } };
}

export async function updateFamily(
  id: string,
  patch: {
    parent_name?: string;
    parent_email?: string | null;
    parent_phone?: string | null;
    shared_billing?: boolean;
    notes?: string | null;
    head_student_id?: string | null;
  },
): Promise<ActionResult> {
  const supabase = createAdminClient() as any;

  // ── Ownership pre-check ────────────────────────────────────────────────────
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: owned } = await supabase
    .from("family_accounts")
    .select("id")
    .eq("id", id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!owned) {
    return { ok: false, error: "Family account not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const update: Database["public"]["Tables"]["family_accounts"]["Update"] = {};
  if (patch.parent_name !== undefined) update.parent_name = patch.parent_name.trim();
  if (patch.parent_email !== undefined) update.parent_email = patch.parent_email?.trim() || null;
  if (patch.parent_phone !== undefined) update.parent_phone = patch.parent_phone?.trim() || null;
  if (patch.shared_billing !== undefined) update.shared_billing = patch.shared_billing;
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
  if (patch.head_student_id !== undefined) update.head_student_id = patch.head_student_id;

  const { error } = await supabase
    .from("family_accounts")
    .update(update)
    .eq("id", id)
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  return { ok: true };
}

export async function addStudentToFamily(
  student_id: string,
  family_id: string,
): Promise<ActionResult> {
  if (!student_id || !family_id) {
    return { ok: false, error: "Student id and family id are required." };
  }
  const supabase = createAdminClient() as any;

  // ── Dual ownership pre-check ──────────────────────────────────────────────────
  // Both the student and the target family must belong to the current gym.
  // Without this, a caller can link any student into any family account across
  // gyms, merging billing/contact records from different tenants.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const [{ data: ownedStudent }, { data: ownedFamily }] = await Promise.all([
    supabase.from("students").select("id").eq("id", student_id).eq("gym_id", gymId).maybeSingle(),
    supabase.from("family_accounts").select("id").eq("id", family_id).eq("gym_id", gymId).maybeSingle(),
  ]);

  if (!ownedStudent) {
    return { ok: false, error: "Student not found or does not belong to this gym." };
  }
  if (!ownedFamily) {
    return { ok: false, error: "Family account not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { error } = await supabase
    .from("students")
    .update({ family_account_id: family_id })
    .eq("id", student_id)
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/students");
  return { ok: true };
}

export async function removeStudentFromFamily(
  student_id: string,
): Promise<ActionResult> {
  const supabase = createAdminClient() as any;

  // ── Ownership check baked into the student fetch ───────────────────────────
  // Adding .eq("gym_id", gymId) to the existing fetch serves double duty:
  // it verifies gym ownership AND retrieves family_account_id in one query.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  // If this student was the family head, clear that pointer too.
  const { data: student } = await supabase
    .from("students")
    .select("family_account_id")
    .eq("id", student_id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!student) {
    return { ok: false, error: "Student not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { error } = await supabase
    .from("students")
    .update({ family_account_id: null })
    .eq("id", student_id)
    .eq("gym_id", gymId);
  if (error) return { ok: false, error: error.message };

  if (student.family_account_id) {
    await supabase
      .from("family_accounts")
      .update({ head_student_id: null })
      .eq("id", student.family_account_id)
      .eq("head_student_id", student_id);

    // If no members left, the family becomes an orphan; we leave it for now.
  }

  revalidatePath("/students");
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Waivers
// ═══════════════════════════════════════════════════════════════════════════

export type SaveWaiverInput = {
  student_id: string;
  waiver_type: string;          // WaiverType enum OR a custom template name
  signature_data: string;       // full data URL: "data:image/png;base64,..."
  signed_by_name?: string | null;
  template_id?: string | null;  // when present: direct template lookup (skips ilike match)
};

export async function saveWaiver(
  input: SaveWaiverInput,
): Promise<ActionResult<{ waiver_id: string }>> {
  if (!input.student_id) return { ok: false, error: "Student id required." };
  if (!input.signature_data?.startsWith("data:image/")) {
    return { ok: false, error: "Signature is empty or invalid." };
  }
  if (!input.waiver_type?.trim()) {
    return { ok: false, error: "Waiver type is required." };
  }
  // Validate against the known enum only when no explicit template_id is provided.
  // With a template_id the caller may pass the template's custom name as waiver_type.
  if (!input.template_id && !(WAIVER_TYPES as readonly string[]).includes(input.waiver_type)) {
    return { ok: false, error: "Invalid waiver type." };
  }
  // Reasonable cap (~1 MB after base64) to avoid runaway payloads.
  if (input.signature_data.length > 1_500_000) {
    return { ok: false, error: "Signature image too large." };
  }

  const supabase = createAdminClient() as any;

  // ── Ownership pre-check (waivers have no gym_id column) ────────────────────
  // Without this, a caller can attach a signed waiver to any student UUID
  // globally — creating false legal records for students at other gyms.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: ownedStudent } = await supabase
    .from("students")
    .select("id")
    .eq("id", input.student_id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!ownedStudent) {
    return { ok: false, error: "Student not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { data, error } = await supabase
    .from("waivers")
    .insert({
      student_id: input.student_id,
      waiver_type: input.waiver_type,
      signature_data: input.signature_data,
      signed_by_name: input.signed_by_name?.trim() || null,
    })
    .select("id, signed_at")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to save waiver." };
  }

  try {
    const pdfUrl = await generateAndStoreSignedPdf(supabase, {
      waiverId: data.id as string,
      studentId: input.student_id,
      signatureData: input.signature_data,
      signedByName: input.signed_by_name?.trim() || null,
      signedAt: data.signed_at as string,
      waiverType: input.waiver_type,
      templateId: input.template_id ?? null,
    });
    if (pdfUrl) {
      await supabase.from("waivers").update({ pdf_url: pdfUrl }).eq("id", data.id);
    }
  } catch {
    // PDF generation is non-critical — waiver record is already saved
  }

  revalidatePath("/students");
  return { ok: true, data: { waiver_id: data.id as string } };
}

const SIGNED_BUCKET = "signed-waivers";

async function generateAndStoreSignedPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: {
    waiverId: string;
    studentId: string;
    signatureData: string;
    signedByName: string | null;
    signedAt: string;
    waiverType: string;
    templateId?: string | null;
  },
): Promise<string | null> {
  const studentRes = await supabase
    .from("students")
    .select("gym_id, full_name")
    .eq("id", opts.studentId)
    .maybeSingle();
  const student = studentRes.data;
  if (!student) return null;

  const gymRes = await supabase
    .from("gyms")
    .select("name")
    .eq("id", student.gym_id)
    .maybeSingle();

  // Look up the template PDF.
  // P2 fix: when templateId is provided use a direct id+gym ownership query;
  // fall back to the ilike name match only for legacy / non-template-linked calls.
  const typeLabel = waiverTypeLabel(opts.waiverType);
  let templateRow: { id: string; pdf_template_url: string | null } | null = null;
  if (opts.templateId) {
    const { data } = await supabase
      .from("waiver_templates")
      .select("id, pdf_template_url")
      .eq("id", opts.templateId)
      .eq("gym_id", student.gym_id)
      .not("pdf_template_url", "is", null)
      .maybeSingle();
    templateRow = data ?? null;
  } else {
    const { data } = await supabase
      .from("waiver_templates")
      .select("id, pdf_template_url")
      .eq("gym_id", student.gym_id)
      .ilike("name", typeLabel)
      .not("pdf_template_url", "is", null)
      .limit(1)
      .maybeSingle();
    templateRow = data ?? null;
  }

  let pdfTemplateBytes: Uint8Array | null = null;
  if (templateRow?.id) {
    const storagePath = `${student.gym_id as string}/${templateRow.id as string}.pdf`;
    const { data: fileBlob, error: dlErr } = await supabase.storage
      .from("waiver-templates")
      .download(storagePath);
    if (!dlErr && fileBlob) {
      pdfTemplateBytes = new Uint8Array(await (fileBlob as Blob).arrayBuffer());
    }
  }

  const { generateSignedWaiverPdf } = await import("@/lib/pdf/sign-waiver");
  const pdfBytes = await generateSignedWaiverPdf({
    signatureDataUrl: opts.signatureData,
    signerName: opts.signedByName ?? (student.full_name as string),
    signedAt: opts.signedAt,
    waiverType: typeLabel,
    gymName: (gymRes?.data?.name as string | null) ?? null,
    pdfTemplateBytes,
  });

  await supabase.storage
    .createBucket(SIGNED_BUCKET, { public: true })
    .catch(() => {});

  const path = `${student.gym_id}/${opts.studentId}/${opts.waiverId}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from(SIGNED_BUCKET)
    .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (uploadErr) return null;

  const { data: urlData } = supabase.storage
    .from(SIGNED_BUCKET)
    .getPublicUrl(path);
  return (urlData?.publicUrl as string) ?? null;
}

export async function deleteWaiver(id: string): Promise<ActionResult> {
  const supabase = createAdminClient() as any;

  // ── Ownership chain: waiver → student → gym ────────────────────────────────
  // The waivers table has no gym_id column, so ownership is resolved through
  // the parent student record.  Two explicit queries are required:
  //   1. Fetch the waiver to get its student_id.
  //   2. Verify that student belongs to the current gym.
  // Both checks must pass before the delete proceeds — waivers are legal
  // documents and their deletion is irreversible.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: waiver } = await supabase
    .from("waivers")
    .select("id, student_id")
    .eq("id", id)
    .maybeSingle();

  if (!waiver) return { ok: false, error: "Waiver not found." };

  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("id", waiver.student_id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!student) {
    return { ok: false, error: "Waiver does not belong to a student in this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { error } = await supabase.from("waivers").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/students");
  return { ok: true };
}
