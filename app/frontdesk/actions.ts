/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { CLASS_TYPES, DEFAULT_CLASS, type ClassType } from "@/lib/checkin";
import { deductClassCredit } from "@/app/(dashboard)/settings/sell/actions";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeClass(input: string | null | undefined): ClassType {
  if (input && (CLASS_TYPES as readonly string[]).includes(input)) {
    return input as ClassType;
  }
  return DEFAULT_CLASS;
}

// ───────────────────────── Check In ─────────────────────────

export async function checkInStudent(
  studentId: string,
  classType: string,
): Promise<ActionResult<{ attendance_id: string; student_name: string }>> {
  if (!studentId) return { ok: false, error: "Student id required." };
  const cls = normalizeClass(classType);

  const supabase = createAdminClient() as any;

  const { data: student, error: studentErr } = await supabase
    .from("students")
    .select("id, full_name")
    .eq("id", studentId)
    .maybeSingle();
  if (studentErr) return { ok: false, error: studentErr.message };
  if (!student) return { ok: false, error: "Student not found." };

  const { data: row, error } = await supabase
    .from("attendance")
    .insert({
      student_id: student.id,
      class_date: todayIsoDate(),
      class_type: cls,
    })
    .select("id")
    .single();

  if (error || !row) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }

  await deductClassCredit(student.id).catch(() => {/* safe to ignore */});

  revalidatePath("/frontdesk");
  return {
    ok: true,
    data: { attendance_id: row.id, student_name: student.full_name },
  };
}

// ───────────────────────── Walk-in (create + check-in) ─────────────────────────

export async function walkInCheckIn(
  name: string,
  phone: string,
  classType: string,
): Promise<ActionResult<{ student_id: string; student_name: string }>> {
  if (!name?.trim()) return { ok: false, error: "Name is required." };
  const cls = normalizeClass(classType);

  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym. Complete onboarding first." };

  const { data: student, error: insertErr } = await supabase
    .from("students")
    .insert({
      gym_id: gymId,
      full_name: name.trim(),
      phone: phone.trim() || null,
      status: "trial",
      belt_rank: "white",
      notes: "Walk-in from front desk kiosk.",
    })
    .select("id, full_name")
    .single();

  if (insertErr || !student) {
    return {
      ok: false,
      error: insertErr?.message ?? "Failed to create walk-in.",
    };
  }

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

  const { error: attErr } = await supabase.from("attendance").insert({
    student_id: student.id,
    class_date: todayIsoDate(),
    class_type: cls,
  });

  if (attErr) return { ok: false, error: attErr.message };

  revalidatePath("/frontdesk");
  revalidatePath("/students");
  return {
    ok: true,
    data: { student_id: student.id, student_name: student.full_name },
  };
}
