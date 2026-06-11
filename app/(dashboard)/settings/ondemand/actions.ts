/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import { INSTRUCTIONAL_CATEGORIES, type InstructionalCategory } from "@/lib/ondemand";
import type { Database } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

type Instructional = Database["public"]["Tables"]["instructionals"]["Row"];
type WatchProgress = Database["public"]["Tables"]["watch_progress"]["Row"];


function stripeErr(e: unknown): string {
  if (typeof e === "object" && e !== null && "message" in e)
    return (e as { message: string }).message;
  return "Unexpected Stripe error.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Instructional CRUD
// ─────────────────────────────────────────────────────────────────────────────

export type InstructionalInput = {
  title: string;
  description?: string | null;
  category: InstructionalCategory;
  price_cents: number;
  duration_seconds?: number | null;
  video_url: string;
  thumbnail_url?: string | null;
  visibility?: "public" | "gym_only";
  is_free?: boolean;
  sort_order?: number;
  published_at?: string | null;
};

function validateInput(input: InstructionalInput): string | null {
  if (!input.title?.trim()) return "Title is required.";
  if (!input.video_url?.trim()) return "Video URL is required.";
  if (!INSTRUCTIONAL_CATEGORIES.includes(input.category))
    return "Invalid category.";
  if (!Number.isFinite(input.price_cents) || input.price_cents < 0)
    return "Price must be 0 or more.";
  return null;
}

export async function createInstructional(
  input: InstructionalInput,
): Promise<ActionResult<{ id: string }>> {
  const role = await getCurrentRole();
  if (!can(role, "edit_ondemand"))
    return { ok: false, error: "No permission to manage instructionals." };

  const err = validateInput(input);
  if (err) return { ok: false, error: err };

  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const isFree = input.is_free ?? input.price_cents === 0;

  const { data, error } = await supabase
    .from("instructionals")
    .insert({
      gym_id: gymId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      price_cents: isFree ? 0 : Math.round(input.price_cents),
      duration_seconds: input.duration_seconds ?? null,
      video_url: input.video_url.trim(),
      thumbnail_url: input.thumbnail_url?.trim() || null,
      visibility: input.visibility ?? "gym_only",
      is_free: isFree,
      sort_order: input.sort_order ?? 0,
      published_at: input.published_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." };
  revalidatePath("/settings/ondemand");
  return { ok: true, data: { id: data.id } };
}

export async function updateInstructional(
  id: string,
  input: Partial<InstructionalInput>,
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_ondemand"))
    return { ok: false, error: "No permission to manage instructionals." };

  const supabase = createAdminClient() as any;
  const patch: any = {};

  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.category !== undefined) patch.category = input.category;
  if (input.price_cents !== undefined) {
    patch.price_cents = Math.round(input.price_cents);
    patch.stripe_price_id = null; // invalidate cached Stripe Price
  }
  if (input.duration_seconds !== undefined) patch.duration_seconds = input.duration_seconds ?? null;
  if (input.video_url !== undefined) patch.video_url = input.video_url.trim();
  if (input.thumbnail_url !== undefined) patch.thumbnail_url = input.thumbnail_url?.trim() || null;
  if (input.visibility !== undefined) patch.visibility = input.visibility;
  if (input.is_free !== undefined) patch.is_free = input.is_free;
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
  if (input.published_at !== undefined) patch.published_at = input.published_at;

  const { error } = await supabase.from("instructionals").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/ondemand");
  return { ok: true };
}

export async function deleteInstructional(id: string): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_ondemand"))
    return { ok: false, error: "No permission to manage instructionals." };

  const supabase = createAdminClient() as any;
  const { error } = await supabase.from("instructionals").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/ondemand");
  return { ok: true };
}

export async function listInstructionals(
  publishedOnly = false,
): Promise<ActionResult<Instructional[]>> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  let q = supabase
    .from("instructionals")
    .select("*")
    .eq("gym_id", gymId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (publishedOnly) q = q.not("published_at", "is", null);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe: ensure one-time Price for an instructional
// ─────────────────────────────────────────────────────────────────────────────

async function ensureInstructionalStripe(
  supabase: any,
  instructionalId: string,
): Promise<{ ok: true; priceId: string } | { ok: false; error: string }> {
  const { data: inst } = await supabase
    .from("instructionals")
    .select("*")
    .eq("id", instructionalId)
    .maybeSingle();
  if (!inst) return { ok: false, error: "Instructional not found." };
  if (inst.stripe_price_id) return { ok: true, priceId: inst.stripe_price_id };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe not configured." };

  try {
    let spId = inst.stripe_product_id;
    if (!spId) {
      const sp = await stripe.products.create({
        name: inst.title,
        description: inst.description ?? undefined,
        metadata: {
          matflow_instructional_id: inst.id,
          matflow_gym_id: inst.gym_id,
        },
      });
      spId = sp.id;
    }
    const price = await stripe.prices.create({
      product: spId,
      currency: "usd",
      unit_amount: inst.price_cents,
      metadata: { matflow_instructional_id: inst.id },
    });
    await supabase
      .from("instructionals")
      .update({ stripe_product_id: spId, stripe_price_id: price.id })
      .eq("id", inst.id);
    return { ok: true, priceId: price.id };
  } catch (e) {
    return { ok: false, error: stripeErr(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout Session for an instructional purchase
// ─────────────────────────────────────────────────────────────────────────────

export async function createInstructionalCheckout(
  studentId: string,
  instructionalId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<ActionResult<{ url: string }>> {
  const supabase = createAdminClient() as any;

  const [studentRes, instRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, email, phone, stripe_customer_id")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("instructionals")
      .select("*")
      .eq("id", instructionalId)
      .maybeSingle(),
  ]);

  if (!studentRes.data) return { ok: false, error: "Student not found." };
  if (!instRes.data) return { ok: false, error: "Instructional not found." };
  const student = studentRes.data;
  const inst = instRes.data;

  // Check already purchased
  const { data: existing } = await supabase
    .from("instructional_purchases")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("instructional_id", instructionalId)
    .maybeSingle();
  if (existing && (existing.status === "paid" || existing.status === "free"))
    return { ok: false, error: "Already purchased." };

  if (!student.email)
    return { ok: false, error: "Student needs an email address to checkout." };

  if (!isStripeConfigured())
    return {
      ok: false,
      error:
        "STRIPE_NOT_CONFIGURED — add STRIPE_SECRET_KEY to enable online purchases.",
    };

  const priceResult = await ensureInstructionalStripe(supabase, instructionalId);
  if (!priceResult.ok) return priceResult;

  const stripe = getStripe()!;

  try {
    let customerId = student.stripe_customer_id;
    if (!customerId) {
      const cust = await stripe.customers.create({
        name: student.full_name,
        email: student.email,
        phone: student.phone ?? undefined,
        metadata: { matflow_student_id: student.id },
      });
      customerId = cust.id;
      await supabase
        .from("students")
        .update({ stripe_customer_id: customerId })
        .eq("id", student.id);
    }

    const gymId = await getCurrentGymId();

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceResult.priceId, quantity: 1 }],
      success_url: `${successUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        matflow_purchase_type: "instructional",
        matflow_student_id: studentId,
        matflow_instructional_id: instructionalId,
        matflow_gym_id: gymId ?? "",
      },
    });

    // Pending row — matched by webhook
    await supabase.from("instructional_purchases").upsert(
      {
        gym_id: gymId ?? inst.gym_id,
        student_id: studentId,
        instructional_id: instructionalId,
        amount_cents: inst.price_cents,
        status: "pending",
        stripe_checkout_session_id: session.id,
      },
      { onConflict: "student_id,instructional_id" },
    );

    return { ok: true, data: { url: session.url! } };
  } catch (e) {
    return { ok: false, error: stripeErr(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grant free access (for free videos or manual grant by staff)
// ─────────────────────────────────────────────────────────────────────────────

export async function grantFreeAccess(
  studentId: string,
  instructionalId: string,
): Promise<ActionResult> {
  const supabase = createAdminClient() as any;
  const instRes = await supabase
    .from("instructionals")
    .select("gym_id, is_free, price_cents")
    .eq("id", instructionalId)
    .maybeSingle();
  if (!instRes.data) return { ok: false, error: "Instructional not found." };
  const gymId = await getCurrentGymId();

  const { error } = await supabase.from("instructional_purchases").upsert(
    {
      gym_id: gymId ?? instRes.data.gym_id,
      student_id: studentId,
      instructional_id: instructionalId,
      amount_cents: 0,
      status: "free",
    },
    { onConflict: "student_id,instructional_id" },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fulfill a completed Checkout Session (called from webhook)
// ─────────────────────────────────────────────────────────────────────────────

export async function fulfillInstructionalCheckout(
  sessionId: string,
  paymentIntentId: string | null,
): Promise<void> {
  const supabase = createAdminClient() as any;
  await supabase
    .from("instructional_purchases")
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId })
    .eq("stripe_checkout_session_id", sessionId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Watch progress
// ─────────────────────────────────────────────────────────────────────────────

export async function saveWatchProgress(
  studentId: string,
  instructionalId: string,
  positionSeconds: number,
  durationSeconds: number | null,
): Promise<void> {
  const supabase = createAdminClient() as any;
  const pct =
    durationSeconds && durationSeconds > 0
      ? Math.min(100, Math.round((positionSeconds / durationSeconds) * 100))
      : 0;
  const completed = pct >= 90;

  await supabase.from("watch_progress").upsert(
    {
      student_id: studentId,
      instructional_id: instructionalId,
      position_seconds: positionSeconds,
      completed_pct: pct,
      completed,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "student_id,instructional_id" },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Student library: videos the student has access to + progress
// ─────────────────────────────────────────────────────────────────────────────

export type StudentLibraryItem = Instructional & {
  access_status: "owned" | "free" | "none";
  progress: WatchProgress | null;
};

export async function getStudentOnDemandData(studentId: string): Promise<
  ActionResult<{
    catalogue: StudentLibraryItem[];
  }>
> {
  const supabase = createAdminClient() as any;

  const gymRes = await supabase
    .from("students")
    .select("gym_id")
    .eq("id", studentId)
    .maybeSingle();
  const gymId = gymRes.data?.gym_id;
  if (!gymId) return { ok: false, error: "Student not found." };

  const [instRes, purchasesRes, progressRes] = await Promise.all([
    supabase
      .from("instructionals")
      .select("*")
      .eq("gym_id", gymId)
      .not("published_at", "is", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("instructional_purchases")
      .select("instructional_id, status")
      .eq("student_id", studentId),
    supabase
      .from("watch_progress")
      .select("*")
      .eq("student_id", studentId),
  ]);

  if (instRes.error) return { ok: false, error: instRes.error.message };

  const purchaseMap = new Map<string, string>();
  for (const p of purchasesRes.data ?? []) {
    purchaseMap.set(p.instructional_id, p.status);
  }

  const progressMap = new Map<string, WatchProgress>();
  for (const p of (progressRes.data ?? []) as WatchProgress[]) {
    progressMap.set(p.instructional_id ?? "", p);
  }

  const catalogue: StudentLibraryItem[] = (instRes.data ?? []).map(
    (inst: Instructional) => {
      const purchaseStatus = purchaseMap.get(inst.id);
      const accessStatus: StudentLibraryItem["access_status"] =
        purchaseStatus === "paid"
          ? "owned"
          : purchaseStatus === "free" || inst.is_free
            ? "free"
            : "none";
      return {
        ...inst,
        access_status: accessStatus,
        progress: progressMap.get(inst.id) ?? null,
      };
    },
  );

  return { ok: true, data: { catalogue } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner watch-stats overview
// ─────────────────────────────────────────────────────────────────────────────

export type OnDemandStats = {
  totalRevenueCents: number;
  totalSales: number;
  totalVideos: number;
  completionCount: number;
};

export async function getOnDemandStats(): Promise<ActionResult<OnDemandStats>> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const [salesRes, videosRes, completionsRes] = await Promise.all([
    supabase
      .from("instructional_purchases")
      .select("amount_cents")
      .eq("gym_id", gymId)
      .eq("status", "paid"),
    supabase
      .from("instructionals")
      .select("id", { count: "exact", head: true })
      .eq("gym_id", gymId),
    supabase
      .from("watch_progress")
      .select("completed", { count: "exact", head: true })
      .eq("completed", true),
  ]);

  return {
    ok: true,
    data: {
      totalRevenueCents: (salesRes.data ?? []).reduce(
        (s: number, r: any) => s + r.amount_cents,
        0,
      ),
      totalSales: salesRes.data?.length ?? 0,
      totalVideos: videosRes.count ?? 0,
      completionCount: completionsRes.count ?? 0,
    },
  };
}
