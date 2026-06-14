/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { GYM_COOKIE } from "@/lib/auth/current-gym";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AdminGym = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  onboarding_completed: boolean;
  timezone: string;
  address: string | null;
};

export type CreateGymInput = {
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
};

type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── List all gyms ─────────────────────────────────────────────────────────────

export async function listAllGyms(): Promise<AdminGym[]> {
  if (!(await isPlatformAdmin())) return [];
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from("gyms")
    .select("id, name, slug, created_at, onboarding_completed, timezone, address")
    .order("created_at", { ascending: false });
  return (data ?? []) as AdminGym[];
}

// ── Create gym + seed ─────────────────────────────────────────────────────────

const STARTER_PLANS = [
  {
    name: "Monthly Unlimited",
    price_cents: 15000,
    interval: "month" as const,
    description: "Unlimited classes every month. Best value for committed students.",
  },
  {
    name: "3× Per Week",
    price_cents: 10000,
    interval: "month" as const,
    description: "Up to 12 classes per month — great for consistent training.",
  },
  {
    name: "Kids Program",
    price_cents: 10000,
    interval: "month" as const,
    description: "Youth classes for ages 4–14. Includes all kids programs.",
  },
  {
    name: "Foundations (Beginner)",
    price_cents: 12000,
    interval: "month" as const,
    description: "Fundamentals track for brand-new students. Includes intro series.",
  },
  {
    name: "Drop-In Pass",
    price_cents: 3000,
    interval: "week" as const,
    description: "Single-week drop-in access. Pay per visit.",
  },
] as const;

export async function createGymWithSeed(
  input: CreateGymInput,
): Promise<ActionResult<{ id: string; name: string; slug: string; plansSeeded: number }>> {
  if (!(await isPlatformAdmin())) {
    return { ok: false, error: "Platform admin access required." };
  }

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Gym name is required." };
  if (name.length < 2) return { ok: false, error: "Gym name must be at least 2 characters." };
  if (!input.timezone) return { ok: false, error: "Timezone is required." };

  const supabase = createAdminClient() as any;

  // Resolve a unique slug
  const baseSlug = (input.slug.trim() ? slugify(input.slug) : slugify(name)) || "gym";
  let slug = baseSlug;
  for (let i = 2; i < 200; i++) {
    const { data: existing } = await supabase
      .from("gyms")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${i}`;
  }

  // Create gym record — mark onboarding as complete so they skip the wizard
  const { data: gym, error: gymErr } = await supabase
    .from("gyms")
    .insert({
      name,
      slug,
      address: input.address?.trim() || null,
      timezone: input.timezone,
      free_class_nudge_after: 3,
      onboarding_completed: true,
    })
    .select("id, slug")
    .single();

  if (gymErr || !gym) {
    return { ok: false, error: gymErr?.message ?? "Failed to create gym." };
  }

  const gymId = gym.id as string;

  // Seed starter membership plans (non-fatal if it fails)
  const { error: plansErr } = await supabase
    .from("membership_plans")
    .insert(STARTER_PLANS.map((p) => ({ ...p, gym_id: gymId })));

  const plansSeeded = plansErr ? 0 : STARTER_PLANS.length;

  revalidatePath("/admin/gyms");
  return { ok: true, data: { id: gymId, name, slug, plansSeeded } };
}

// ── Switch active gym ─────────────────────────────────────────────────────────

export async function adminSwitchGym(
  gymId: string,
): Promise<ActionResult> {
  if (!(await isPlatformAdmin())) {
    return { ok: false, error: "Platform admin access required." };
  }

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
