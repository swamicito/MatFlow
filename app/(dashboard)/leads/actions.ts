"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import type { LeadStatus } from "@/lib/supabase/types";
import { LEAD_STATUSES } from "@/lib/leads";

export type CreateLeadInput = {
  name: string;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  notes?: string | null;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Creates a new lead for the authenticated user's gym.
 * Relies on RLS: `gym_id` is set from the profile of the requesting user.
 */
export async function createLead(input: CreateLeadInput): Promise<ActionResult> {
  if (!input.name?.trim()) {
    return { ok: false, error: "Name is required." };
  }

  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym. Complete onboarding first." };

  const { error } = await supabase.from("leads").insert({
    gym_id: gymId,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    source: input.source?.trim() || null,
    notes: input.notes?.trim() || null,
    status: "new",
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/leads");
  return { ok: true };
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus,
): Promise<ActionResult> {
  if (!LEAD_STATUSES.includes(status)) {
    return { ok: false, error: "Invalid status." };
  }

  const supabase = createAdminClient() as any;

  // ── Ownership pre-check ────────────────────────────────────────────────────
  // Without this, any caller with a lead UUID can set it to "converted" or
  // "lost" — corrupting another gym's sales pipeline without touching their
  // own data.  leads has a gym_id column so a single scoped query is enough.
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: owned } = await supabase
    .from("leads")
    .select("id")
    .eq("id", id)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!owned) {
    return { ok: false, error: "Lead not found or does not belong to this gym." };
  }
  // ──────────────────────────────────────────────────────────────────────────

  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", id)
    .eq("gym_id", gymId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/leads");
  return { ok: true };
}
