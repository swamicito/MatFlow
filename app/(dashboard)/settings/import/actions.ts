/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import {
  coerceBelt,
  coerceCents,
  coerceDate,
  coerceStatus,
  coerceStripes,
  nz,
  type FieldKey,
} from "@/lib/import/schema";
import type { Database, MembershipInterval } from "@/lib/supabase/types";

// ─────────────────── Public types ───────────────────

export type Mapping = Record<string, FieldKey>; // header -> field

export type ImportRequest = {
  headers: string[];
  rows: Record<string, string>[];
  mapping: Mapping;
  /** Indices (in `rows`) the user opted to skip from preview. */
  skipIndices?: number[];
  /** If true, no DB writes are performed. */
  dryRun: boolean;
  /**
   * If a membership_plan column is mapped, default plan interval used when
   * we have to create new plans on the fly.
   */
  defaultInterval?: MembershipInterval;
  /**
   * Controls which rows are written:
   * - "all" (default): create new + update existing
   * - "new_only": skip rows that match an existing student
   * - "update_only": skip rows with no match (would be creates)
   */
  importMode?: "all" | "new_only" | "update_only";
};

export type RowIssue = {
  level: "error" | "warning";
  message: string;
};

export type MatchReason = "email" | "phone" | "name" | null;

export type PreviewRow = {
  index: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  belt_rank: string | null;
  status: string | null;
  plan: string | null;
  effective_price_cents: number | null;
  action: "create" | "update" | "skip";
  matched_student_id: string | null;
  match_reason: MatchReason;
  issues: RowIssue[];
};

export type ImportResult = {
  ok: boolean;
  dryRun: boolean;
  totals: {
    parsed: number;
    skipped: number;
    creatable: number;
    updatable: number;
    errors: number;
    plans_created: number;
    memberships_created: number;
    belt_progress_created: number;
  };
  rows: PreviewRow[];
  /** Top-level fatal issue, if any. */
  fatal?: string;
};

// ─────────────────── Mapping helpers ───────────────────

function findHeaderFor(mapping: Mapping, field: FieldKey): string | null {
  for (const [header, key] of Object.entries(mapping)) {
    if (key === field) return header;
  }
  return null;
}

function getField(
  row: Record<string, string>,
  mapping: Mapping,
  field: FieldKey,
): string | null {
  const header = findHeaderFor(mapping, field);
  if (!header) return null;
  return nz(row[header]);
}

function deriveFullName(
  row: Record<string, string>,
  mapping: Mapping,
): string | null {
  const direct = getField(row, mapping, "full_name");
  if (direct) return direct;
  const first = getField(row, mapping, "first_name");
  const last = getField(row, mapping, "last_name");
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined.length > 0 ? combined : null;
}

// ─────────────────── Core importer ───────────────────

/**
 * The single entry point: runs validation, optionally writes to the DB,
 * and returns a structured `ImportResult` for the UI to render.
 */
export async function runImport(req: ImportRequest): Promise<ImportResult> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  // Per-call cache so concurrent imports never collide.
  const cached = new Map<number, CachedRow>();

  const baseTotals = {
    parsed: req.rows.length,
    skipped: 0,
    creatable: 0,
    updatable: 0,
    errors: 0,
    plans_created: 0,
    memberships_created: 0,
    belt_progress_created: 0,
  };

  if (!gymId) {
    return {
      ok: false,
      dryRun: req.dryRun,
      totals: baseTotals,
      rows: [],
      fatal: 'No active gym found. Make sure you have a gym configured.',
    };
  }

  const skip = new Set(req.skipIndices ?? []);

  // Existing students in this gym, indexed by lowercased email AND lowercased
  // full_name, so we can detect updates vs. creates.
  const { data: existing, error: existingErr } = await supabase
    .from("students")
    .select("id, full_name, email, phone")
    .eq("gym_id", gymId);

  if (existingErr) {
    return {
      ok: false,
      dryRun: req.dryRun,
      totals: baseTotals,
      rows: [],
      fatal: `Could not load existing students: ${existingErr.message}`,
    };
  }

  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const s of existing ?? []) {
    if (s.email) byEmail.set(s.email.toLowerCase(), s.id);
    if (s.phone) {
      const normalised = s.phone.replace(/\D/g, "");
      if (normalised.length >= 7) byPhone.set(normalised, s.id);
    }
    byName.set(s.full_name.toLowerCase().trim(), s.id);
  }

  // Pre-load existing plans (we may need to create new ones).
  const { data: existingPlans } = await supabase
    .from("membership_plans")
    .select("id, name, price_cents, interval")
    .eq("gym_id", gymId);

  const planByName = new Map<
    string,
    { id: string; price_cents: number; interval: MembershipInterval }
  >();
  for (const p of existingPlans ?? []) {
    planByName.set(p.name.toLowerCase().trim(), {
      id: p.id,
      price_cents: p.price_cents,
      interval: p.interval,
    });
  }

  const previewRows: PreviewRow[] = [];

  // ── Pass 1: Validate every row, decide create/update/skip ──
  for (let i = 0; i < req.rows.length; i += 1) {
    const raw = req.rows[i];
    const issues: RowIssue[] = [];

    if (skip.has(i)) {
      previewRows.push({
        index: i,
        full_name: deriveFullName(raw, req.mapping),
        email: getField(raw, req.mapping, "email"),
        phone: getField(raw, req.mapping, "phone"),
        belt_rank: getField(raw, req.mapping, "belt_rank"),
        status: getField(raw, req.mapping, "status"),
        plan: getField(raw, req.mapping, "membership_plan"),
        effective_price_cents: null,
        action: "skip",
        matched_student_id: null,
        match_reason: null,
        issues: [],
      });
      continue;
    }

    const fullName = deriveFullName(raw, req.mapping);
    if (!fullName) {
      issues.push({
        level: "error",
        message: "Missing name. Map Full Name (or First + Last Name).",
      });
    }

    const email = getField(raw, req.mapping, "email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      issues.push({ level: "warning", message: `Email looks invalid: ${email}` });
    }

    const dob = coerceDate(getField(raw, req.mapping, "date_of_birth"));
    if (
      getField(raw, req.mapping, "date_of_birth") &&
      !dob
    ) {
      issues.push({ level: "warning", message: "Could not parse date of birth." });
    }
    const joinDate = coerceDate(getField(raw, req.mapping, "join_date"));

    const belt = coerceBelt(getField(raw, req.mapping, "belt_rank"));
    const stripes = coerceStripes(getField(raw, req.mapping, "stripes"));
    const status = coerceStatus(getField(raw, req.mapping, "status"));

    const planName = getField(raw, req.mapping, "membership_plan");
    const planPriceCents = coerceCents(
      getField(raw, req.mapping, "membership_price"),
    );
    const customPriceCents = coerceCents(
      getField(raw, req.mapping, "custom_price"),
    );

    if (planName && !planPriceCents && !planByName.has(planName.toLowerCase().trim())) {
      issues.push({
        level: "warning",
        message: `Plan "${planName}" has no price and doesn't exist yet — will be created at $0.`,
      });
    }

    let action: PreviewRow["action"] = "create";
    let matched: string | null = null;
    let matchReason: MatchReason = null;

    if (fullName) {
      const byEmailHit = email ? byEmail.get(email.toLowerCase()) : undefined;
      const phoneNorm = getField(raw, req.mapping, "phone")?.replace(/\D/g, "") ?? "";
      const byPhoneHit = phoneNorm.length >= 7 ? byPhone.get(phoneNorm) : undefined;
      const byNameHit = byName.get(fullName.toLowerCase().trim());

      if (byEmailHit) {
        matched = byEmailHit;
        action = "update";
        matchReason = "email";
      } else if (byPhoneHit) {
        matched = byPhoneHit;
        action = "update";
        matchReason = "phone";
      } else if (byNameHit) {
        matched = byNameHit;
        action = "update";
        matchReason = "name";
      }
    }

    // Apply import mode filter
    const mode = req.importMode ?? "all";
    if (mode === "new_only" && action === "update") {
      action = "skip";
      issues.push({ level: "warning", message: "Skipped: student already exists (new-only mode)." });
    } else if (mode === "update_only" && action === "create") {
      action = "skip";
      issues.push({ level: "warning", message: "Skipped: no match found (update-only mode)." });
    }

    if (issues.some((x) => x.level === "error")) {
      action = "skip";
    }

    previewRows.push({
      index: i,
      full_name: fullName,
      email,
      phone: getField(raw, req.mapping, "phone"),
      belt_rank: belt,
      status,
      plan: planName,
      effective_price_cents: customPriceCents ?? planPriceCents,
      action,
      matched_student_id: matched,
      match_reason: matchReason,
      issues,
    });

    // Stash coerced state on the row for pass 2.
    cached.set(i, {
      full_name: fullName,
      email,
      phone: getField(raw, req.mapping, "phone"),
      dob,
      joinDate,
      belt,
      stripes,
      status,
      planName,
      planPriceCents,
      customPriceCents,
      notes: getField(raw, req.mapping, "notes"),
      renewalDate: coerceDate(getField(raw, req.mapping, "renewal_date")),
      attendanceCount: parseInt(getField(raw, req.mapping, "attendance_count") ?? "", 10) || null,
    });
  }

  const totals = {
    ...baseTotals,
    skipped: previewRows.filter((r) => r.action === "skip").length,
    creatable: previewRows.filter((r) => r.action === "create").length,
    updatable: previewRows.filter((r) => r.action === "update").length,
    errors: previewRows.reduce(
      (acc, r) =>
        acc + r.issues.filter((x) => x.level === "error").length,
      0,
    ),
  };

  if (req.dryRun) {
    return {
      ok: true,
      dryRun: true,
      totals,
      rows: previewRows,
    };
  }

  // ── Pass 2: Actually write to the DB. ──

  // 2a) Create any missing plans first.
  const planNamesNeeded = new Set<string>();
  for (const r of previewRows) {
    if (r.action === "skip") continue;
    if (r.plan) planNamesNeeded.add(r.plan.trim());
  }

  for (const planName of planNamesNeeded) {
    const lower = planName.toLowerCase().trim();
    if (planByName.has(lower)) continue;

    // Pick a price: max price cents across rows that reference this plan,
    // falling back to 0.
    let bestCents = 0;
    for (const r of previewRows) {
      if (r.plan?.trim().toLowerCase() === lower) {
        const c = r.effective_price_cents ?? 0;
        if (c > bestCents) bestCents = c;
      }
    }

    const { data: created, error: planErr } = await supabase
      .from("membership_plans")
      .insert({
        gym_id: gymId,
        name: planName,
        price_cents: bestCents,
        interval: req.defaultInterval ?? "month",
        description: "Imported from Mindbody",
      })
      .select("id, price_cents, interval")
      .single();

    if (planErr || !created) {
      return {
        ok: false,
        dryRun: false,
        totals,
        rows: previewRows,
        fatal: `Failed to create plan "${planName}": ${planErr?.message ?? "unknown"}`,
      };
    }

    planByName.set(lower, {
      id: created.id,
      price_cents: created.price_cents,
      interval: created.interval,
    });
    totals.plans_created += 1;
  }

  // 2b) Per-row student upsert + belt_progress + membership.
  for (const r of previewRows) {
    if (r.action === "skip") continue;
    const c = cached.get(r.index);
    if (!c) continue;

    let studentId = r.matched_student_id;

    const studentPayload: any = {
      gym_id: gymId,
      full_name: c.full_name!,
      email: c.email,
      phone: c.phone,
      date_of_birth: c.dob,
      join_date: c.joinDate ?? new Date().toISOString().slice(0, 10),
      belt_rank: c.belt,
      status: c.status,
      notes: c.notes ? `[Mindbody Import] ${c.notes}` : "[Mindbody Import]",
      custom_monthly_price_cents: c.customPriceCents,
    };

    if (r.action === "create") {
      const { data: ins, error: sErr } = await supabase
        .from("students")
        .insert(studentPayload)
        .select("id")
        .single();
      if (sErr || !ins) {
        r.issues.push({ level: "error", message: `DB error: ${sErr?.message ?? "unknown"}` });
        totals.errors += 1;
        continue;
      }
      studentId = ins.id;
    } else if (r.action === "update" && studentId) {
      const { error: uErr } = await supabase
        .from("students")
        .update({
          phone: c.phone ?? undefined,
          date_of_birth: c.dob ?? undefined,
          belt_rank: c.belt,
          status: c.status,
          custom_monthly_price_cents: c.customPriceCents ?? undefined,
        })
        .eq("id", studentId);
      if (uErr) {
        r.issues.push({ level: "error", message: `DB error: ${uErr.message}` });
        totals.errors += 1;
        continue;
      }
    }

    if (!studentId) continue;

    // Belt progress (idempotent upsert by student_id).
    const { error: bpErr } = await supabase
      .from("belt_progress")
      .upsert(
        {
          student_id: studentId,
          current_belt: c.belt,
          stripes: c.stripes,
          progress_percentage: 0,
        },
        { onConflict: "student_id" },
      );
    if (bpErr) {
      r.issues.push({ level: "warning", message: `Belt progress: ${bpErr.message}` });
    } else {
      totals.belt_progress_created += 1;
    }

    // Membership: only attach if a plan was specified AND no active membership
    // exists for this student already.
    if (c.planName) {
      const planRef = planByName.get(c.planName.toLowerCase().trim());
      if (!planRef) {
        r.issues.push({
          level: "warning",
          message: `Plan "${c.planName}" was not registered.`,
        });
      } else {
        const { data: existingMem } = await supabase
          .from("memberships")
          .select("id")
          .eq("student_id", studentId)
          .in("status", ["active", "trialing", "past_due", "paused"])
          .maybeSingle();

        if (!existingMem) {
          const { error: memErr } = await supabase.from("memberships").insert({
            student_id: studentId,
            plan_id: planRef.id,
            custom_price_cents: c.customPriceCents,
            status: "active",
            start_date: c.joinDate ?? new Date().toISOString().slice(0, 10),
            current_period_end: c.renewalDate ?? undefined,
            cancel_at_period_end: false,
          });
          if (memErr) {
            r.issues.push({
              level: "warning",
              message: `Membership: ${memErr.message}`,
            });
          } else {
            totals.memberships_created += 1;
          }
        }
      }
    }
  }

  revalidatePath("/students");
  revalidatePath("/billing");
  revalidatePath("/settings/import");

  return {
    ok: totals.errors === 0,
    dryRun: false,
    totals,
    rows: previewRows,
  };
}

// Per-call cache record for coerced row values, populated in pass 1 and
// re-used in pass 2. Declared at module scope so the type is hoisted, but
// the actual `Map` is created inside `runImport` (so concurrent imports
// can't collide).
type CachedRow = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  dob: string | null;
  joinDate: string | null;
  belt: ReturnType<typeof coerceBelt>;
  stripes: number;
  status: ReturnType<typeof coerceStatus>;
  planName: string | null;
  planPriceCents: number | null;
  customPriceCents: number | null;
  notes: string | null;
  renewalDate: string | null;
  attendanceCount: number | null;
};
