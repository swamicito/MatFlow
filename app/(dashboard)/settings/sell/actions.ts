/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import {
  creditsForProduct,
  expiresAt,
  giftCardCents,
  PRODUCT_TYPES,
  type ProductType,
} from "@/lib/shop";
import type { Database } from "@/lib/supabase/types";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

type Product = Database["public"]["Tables"]["products"]["Row"];
type Purchase = Database["public"]["Tables"]["purchases"]["Row"];

function stripeErr(e: unknown): string {
  if (typeof e === "object" && e !== null && "message" in e)
    return (e as { message: string }).message;
  return "Unexpected Stripe error.";
}

// ─────────────────────────────────────────────────────────────────────────────
// Product CRUD
// ─────────────────────────────────────────────────────────────────────────────

export type ProductInput = {
  name: string;
  description?: string | null;
  product_type: ProductType;
  price_cents: number;
  original_price_cents?: number | null;
  class_credits: number;
  validity_days?: number | null;
  max_quantity?: number | null;
  visible?: boolean;
  special_start_date?: string | null;
  special_end_date?: string | null;
  sort_order?: number;
};

function validateProduct(input: ProductInput): string | null {
  if (!input.name?.trim()) return "Name is required.";
  if (!PRODUCT_TYPES.includes(input.product_type))
    return "Invalid product type.";
  if (!Number.isFinite(input.price_cents) || input.price_cents < 0)
    return "Price must be a non-negative number.";
  if (!Number.isFinite(input.class_credits) || input.class_credits < 0)
    return "Class credits must be 0 or more.";
  if (
    input.special_start_date &&
    input.special_end_date &&
    input.special_start_date >= input.special_end_date
  )
    return "Special end date must be after start date.";
  return null;
}

export async function createProduct(
  input: ProductInput,
): Promise<ActionResult<{ id: string }>> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings"))
    return { ok: false, error: "Only owners/admins can manage products." };

  const err = validateProduct(input);
  if (err) return { ok: false, error: err };

  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data, error } = await supabase
    .from("products")
    .insert({
      gym_id: gymId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      product_type: input.product_type,
      price_cents: Math.round(input.price_cents),
      original_price_cents: input.original_price_cents
        ? Math.round(input.original_price_cents)
        : null,
      class_credits: Math.round(input.class_credits),
      validity_days: input.validity_days ?? null,
      max_quantity: input.max_quantity ?? null,
      visible: input.visible ?? true,
      special_start_date: input.special_start_date ?? null,
      special_end_date: input.special_end_date ?? null,
      sort_order: input.sort_order ?? 0,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." };
  revalidatePath("/settings/sell");
  return { ok: true, data: { id: data.id } };
}

export async function updateProduct(
  id: string,
  input: Partial<ProductInput>,
): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings"))
    return { ok: false, error: "Only owners/admins can manage products." };

  const supabase = createAdminClient() as any;
  const patch: Database["public"]["Tables"]["products"]["Update"] = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.product_type !== undefined) patch.product_type = input.product_type;
  if (input.price_cents !== undefined) patch.price_cents = Math.round(input.price_cents);
  if (input.original_price_cents !== undefined)
    patch.original_price_cents = input.original_price_cents
      ? Math.round(input.original_price_cents)
      : null;
  if (input.class_credits !== undefined) patch.class_credits = Math.round(input.class_credits);
  if (input.validity_days !== undefined) patch.validity_days = input.validity_days ?? null;
  if (input.max_quantity !== undefined) patch.max_quantity = input.max_quantity ?? null;
  if (input.visible !== undefined) patch.visible = input.visible;
  if (input.special_start_date !== undefined) patch.special_start_date = input.special_start_date ?? null;
  if (input.special_end_date !== undefined) patch.special_end_date = input.special_end_date ?? null;
  if (input.sort_order !== undefined) patch.sort_order = input.sort_order;

  // If price changed, invalidate the cached Stripe Price.
  if (input.price_cents !== undefined) patch.stripe_price_id = null;

  const { error } = await supabase.from("products").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/sell");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings"))
    return { ok: false, error: "Only owners/admins can manage products." };

  const supabase = createAdminClient() as any;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings/sell");
  return { ok: true };
}

export async function listProducts(
  visibleOnly = false,
): Promise<ActionResult<Product[]>> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  let q = supabase
    .from("products")
    .select("*")
    .eq("gym_id", gymId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (visibleOnly) q = q.eq("visible", true);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales stats for the owner dashboard
// ─────────────────────────────────────────────────────────────────────────────

export type SalesStats = {
  totalRevenueCents: number;
  totalPurchases: number;
  thisMonthRevenueCents: number;
  thisMonthPurchases: number;
  recentPurchases: (Purchase & { product_name: string | null; student_name: string })[];
};

export async function getSalesStats(): Promise<ActionResult<SalesStats>> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const firstOfMonth = new Date();
  firstOfMonth.setDate(1);
  firstOfMonth.setHours(0, 0, 0, 0);

  const [allRes, monthRes, recentRes] = await Promise.all([
    supabase
      .from("purchases")
      .select("amount_cents")
      .eq("gym_id", gymId)
      .eq("status", "paid"),
    supabase
      .from("purchases")
      .select("amount_cents")
      .eq("gym_id", gymId)
      .eq("status", "paid")
      .gte("created_at", firstOfMonth.toISOString()),
    supabase
      .from("purchases")
      .select("*, products:products(name), students:students(full_name)")
      .eq("gym_id", gymId)
      .in("status", ["paid", "manual"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (allRes.error) return { ok: false, error: allRes.error.message };

  type RecentRow = Purchase & {
    products: { name: string } | null;
    students: { full_name: string } | null;
  };

  const recent = ((recentRes.data ?? []) as unknown as RecentRow[]).map((r) => ({
    ...r,
    product_name: r.products?.name ?? null,
    student_name: r.students?.full_name ?? "Unknown",
  }));

  return {
    ok: true,
    data: {
      totalRevenueCents: (allRes.data ?? []).reduce((s: number, r: any) => s + r.amount_cents, 0),
      totalPurchases: (allRes.data ?? []).length,
      thisMonthRevenueCents: (monthRes.data ?? []).reduce((s: number, r: any) => s + r.amount_cents, 0),
      thisMonthPurchases: (monthRes.data ?? []).length,
      recentPurchases: recent,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe: ensure one-time Price exists for a product
// ─────────────────────────────────────────────────────────────────────────────

async function ensureProductStripe(
  supabase: any,
  productId: string,
): Promise<{ ok: true; priceId: string } | { ok: false; error: string }> {
  const { data: p } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();
  if (!p) return { ok: false, error: "Product not found." };
  if (p.stripe_price_id) return { ok: true, priceId: p.stripe_price_id };

  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe not configured." };

  try {
    let stripeProductId = p.stripe_product_id;
    if (!stripeProductId) {
      const sp = await stripe.products.create({
        name: p.name,
        description: p.description ?? undefined,
        metadata: { matflow_product_id: p.id, matflow_gym_id: p.gym_id },
      });
      stripeProductId = sp.id;
    }
    const price = await stripe.prices.create({
      product: stripeProductId,
      currency: "usd",
      unit_amount: p.price_cents,
      metadata: { matflow_product_id: p.id },
    });
    await supabase
      .from("products")
      .update({ stripe_product_id: stripeProductId, stripe_price_id: price.id })
      .eq("id", p.id);
    return { ok: true, priceId: price.id };
  } catch (e) {
    return { ok: false, error: stripeErr(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Stripe Checkout Session
// ─────────────────────────────────────────────────────────────────────────────

export async function createCheckoutSession(
  studentId: string,
  productId: string,
  quantity = 1,
  successUrl: string,
  cancelUrl: string,
): Promise<ActionResult<{ url: string }>> {
  const supabase = createAdminClient() as any;

  const [studentRes, productRes] = await Promise.all([
    supabase
      .from("students")
      .select("id, full_name, email, phone, stripe_customer_id")
      .eq("id", studentId)
      .maybeSingle(),
    supabase.from("products").select("*").eq("id", productId).maybeSingle(),
  ]);

  if (!studentRes.data) return { ok: false, error: "Student not found." };
  if (!productRes.data) return { ok: false, error: "Product not found." };
  const student = studentRes.data;
  const product = productRes.data;

  if (!product.visible) return { ok: false, error: "Product is not available." };
  if (!student.email)
    return {
      ok: false,
      error: "Student needs an email address to checkout. Add one first.",
    };

  if (!isStripeConfigured()) {
    return {
      ok: false,
      error:
        "STRIPE_NOT_CONFIGURED — the owner must add STRIPE_SECRET_KEY to enable online purchases.",
    };
  }

  const priceResult = await ensureProductStripe(supabase, productId);
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
      line_items: [{ price: priceResult.priceId, quantity }],
      success_url: `${successUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        matflow_student_id: studentId,
        matflow_product_id: productId,
        matflow_gym_id: gymId ?? "",
        quantity: String(quantity),
      },
    });

    // Create a pending purchase row so we can match the webhook.
    const creditsGranted = creditsForProduct(
      product.product_type as ProductType,
      product.class_credits,
      quantity,
    );
    const expiry = expiresAt(new Date(), product.validity_days);

    await supabase.from("purchases").insert({
      gym_id: gymId ?? product.gym_id,
      student_id: studentId,
      product_id: productId,
      quantity,
      amount_cents: product.price_cents * quantity,
      status: "pending",
      stripe_checkout_session_id: session.id,
      credits_granted: creditsGranted,
      expires_at: expiry?.toISOString() ?? null,
    });

    return { ok: true, data: { url: session.url! } };
  } catch (e) {
    return { ok: false, error: stripeErr(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual purchase (no Stripe — front desk records a cash / card sale)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordManualPurchase(input: {
  studentId: string;
  productId: string;
  quantity?: number;
  notes?: string;
}): Promise<ActionResult<{ purchaseId: string }>> {
  const role = await getCurrentRole();
  if (!can(role, "edit_billing") && !can(role, "edit_students"))
    return { ok: false, error: "No permission to record purchases." };

  const supabase = createAdminClient() as any;
  const [studentRes, productRes] = await Promise.all([
    supabase.from("students").select("id, gym_id").eq("id", input.studentId).maybeSingle(),
    supabase.from("products").select("*").eq("id", input.productId).maybeSingle(),
  ]);

  if (!studentRes.data) return { ok: false, error: "Student not found." };
  if (!productRes.data) return { ok: false, error: "Product not found." };
  const product = productRes.data;
  const qty = input.quantity ?? 1;
  const gymId = await getCurrentGymId();

  const creditsGranted = creditsForProduct(
    product.product_type as ProductType,
    product.class_credits,
    qty,
  );
  const giftCents = giftCardCents(
    product.product_type as ProductType,
    product.price_cents,
    qty,
  );
  const expiry = expiresAt(new Date(), product.validity_days);

  const { data: purchase, error: purchaseErr } = await supabase
    .from("purchases")
    .insert({
      gym_id: gymId ?? product.gym_id,
      student_id: input.studentId,
      product_id: input.productId,
      quantity: qty,
      amount_cents: product.price_cents * qty,
      status: "manual",
      credits_granted: creditsGranted,
      expires_at: expiry?.toISOString() ?? null,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (purchaseErr || !purchase)
    return { ok: false, error: purchaseErr?.message ?? "Insert failed." };

  // Credit the student immediately.
  await applyCredits(supabase, input.studentId, creditsGranted, giftCents);

  revalidatePath("/students");
  revalidatePath("/settings/sell");
  return { ok: true, data: { purchaseId: purchase.id } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fulfill a completed Checkout Session (called from webhook)
// ─────────────────────────────────────────────────────────────────────────────

export async function fulfillCheckoutSession(
  sessionId: string,
  paymentIntentId: string | null,
): Promise<void> {
  const supabase = createAdminClient() as any;

  const { data: purchase } = await supabase
    .from("purchases")
    .select("*, products:products(product_type, price_cents, class_credits, validity_days)")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (!purchase) return; // webhook fired before row inserted — idempotent

  // If already paid, skip.
  if (purchase.status === "paid") return;

  type PurchaseWithProduct = typeof purchase & {
    products: {
      product_type: string;
      price_cents: number;
      class_credits: number;
      validity_days: number | null;
    } | null;
  };

  const p = purchase as unknown as PurchaseWithProduct;
  const prod = p.products;

  const creditsGranted = prod
    ? creditsForProduct(
        prod.product_type as ProductType,
        prod.class_credits,
        purchase.quantity,
      )
    : purchase.credits_granted;

  const giftCents = prod
    ? giftCardCents(
        prod.product_type as ProductType,
        prod.price_cents,
        purchase.quantity,
      )
    : 0;

  await supabase
    .from("purchases")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      credits_granted: creditsGranted,
    })
    .eq("id", purchase.id);

  await applyCredits(supabase, purchase.student_id, creditsGranted, giftCents);
}

// ─────────────────────────────────────────────────────────────────────────────
// Credit helpers
// ─────────────────────────────────────────────────────────────────────────────

async function applyCredits(
  supabase: any,
  studentId: string,
  classCredits: number,
  giftCardCents: number,
): Promise<void> {
  if (classCredits === 0 && giftCardCents === 0) return;

  const { data: existing } = await supabase
    .from("student_credits")
    .select("class_credits, gift_card_balance_cents")
    .eq("student_id", studentId)
    .maybeSingle();

  await supabase
    .from("student_credits")
    .upsert(
      {
        student_id: studentId,
        class_credits: (existing?.class_credits ?? 0) + classCredits,
        gift_card_balance_cents:
          (existing?.gift_card_balance_cents ?? 0) + giftCardCents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_id" },
    );
}

/** Deduct one class credit. Returns false if balance was already 0. */
export async function deductClassCredit(studentId: string): Promise<boolean> {
  const supabase = createAdminClient() as any;
  const { data } = await supabase
    .from("student_credits")
    .select("class_credits")
    .eq("student_id", studentId)
    .maybeSingle();

  if (!data || data.class_credits <= 0) return false;

  await supabase
    .from("student_credits")
    .update({
      class_credits: data.class_credits - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", studentId);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Student-facing: get credits + purchase history
// ─────────────────────────────────────────────────────────────────────────────

export type StudentShopData = {
  credits: { class_credits: number; gift_card_balance_cents: number } | null;
  purchases: (Purchase & { product_name: string | null })[];
  products: Database["public"]["Tables"]["products"]["Row"][];
};

export async function getStudentShopData(
  studentId: string,
): Promise<ActionResult<StudentShopData>> {
  const supabase = createAdminClient() as any;

  const [creditsRes, purchasesRes, gymRes] = await Promise.all([
    supabase
      .from("student_credits")
      .select("class_credits, gift_card_balance_cents")
      .eq("student_id", studentId)
      .maybeSingle(),
    supabase
      .from("purchases")
      .select("*, products:products(name)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("students").select("gym_id").eq("id", studentId).maybeSingle(),
  ]);

  const gymId = gymRes.data?.gym_id;
  const today = new Date().toISOString().slice(0, 10);
  const productsRes = gymId
    ? await supabase
        .from("products")
        .select("*")
        .eq("gym_id", gymId)
        .eq("visible", true)
        .or(
          `special_end_date.is.null,special_end_date.gte.${today}`,
        )
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
    : { data: [], error: null };

  type PurchaseRow = Purchase & { products: { name: string } | null };
  const purchases = ((purchasesRes.data ?? []) as unknown as PurchaseRow[]).map(
    (r) => ({ ...r, product_name: r.products?.name ?? null }),
  );

  return {
    ok: true,
    data: {
      credits: creditsRes.data ?? null,
      purchases,
      products: productsRes.data ?? [],
    },
  };
}
