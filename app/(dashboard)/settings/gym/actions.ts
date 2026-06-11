/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import { GYM_COOKIE } from "@/lib/auth/current-gym";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function createGym(
  name: string,
): Promise<ActionResult<{ id: string; slug: string }>> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners can create a new gym." };
  }

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Gym name is required." };
  if (trimmed.length < 3) return { ok: false, error: "Gym name must be at least 3 characters." };

  const supabase = createAdminClient() as any;

  // Build a unique slug
  const base = slugify(trimmed) || "gym";
  let slug = base;
  for (let i = 2; i < 100; i++) {
    const { data } = await supabase
      .from("gyms")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }

  const { data, error } = await supabase
    .from("gyms")
    .insert({ name: trimmed, slug })
    .select("id, slug")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create gym." };
  }

  // Persist the new gym_id in the cookie so the user is immediately switched to it
  const store = await cookies();
  store.set(GYM_COOKIE, data.id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  return { ok: true, data: { id: data.id, slug: data.slug } };
}

export async function updateGymSettings(input: {
  free_class_nudge_after?: number;
}): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners can update gym settings." };
  }

  const { getCurrentGymId } = await import("@/lib/auth/current-gym");
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const patch: Record<string, unknown> = {};

  if (input.free_class_nudge_after !== undefined) {
    const val = Math.round(input.free_class_nudge_after);
    if (!Number.isFinite(val) || val < 1 || val > 100) {
      return { ok: false, error: "Free class nudge threshold must be between 1 and 100." };
    }
    patch.free_class_nudge_after = val;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("gyms")
    .update(patch)
    .eq("id", gymId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/gym");
  revalidatePath("/settings/automation");
  return { ok: true };
}

export async function switchGym(
  gymId: string,
): Promise<ActionResult> {
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from("gyms")
    .select("id")
    .eq("id", gymId)
    .maybeSingle();

  if (!data) return { ok: false, error: "Gym not found." };

  const store = await cookies();
  store.set(GYM_COOKIE, gymId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
