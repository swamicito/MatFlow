/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import type { BeltRank } from "@/lib/supabase/types";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type PortalStudent = {
  id: string;
  full_name: string;
  email: string | null;
  belt_rank: BeltRank;
  status: string;
  join_date: string;
  gym_id: string;
};

export type PortalBeltProgress = {
  current_belt: BeltRank;
  stripes: number;
  progress_percentage: number;
};

export type PortalAttendanceDay = {
  date: string; // ISO date "YYYY-MM-DD"
  count: number;
};

export type PortalBadge = {
  id: string;
  badge_key: string;
  earned_at: string;
};

export type PortalGoal = {
  weekly_target: number;
};

export type PortalCredits = {
  class_credits: number;
  gift_card_balance_cents: number;
};

export type PortalPurchase = {
  id: string;
  product_name: string | null;
  amount_cents: number;
  status: string;
  credits_granted: number;
  created_at: string;
  expires_at: string | null;
};

export type PortalInstructional = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  video_url: string;
  position_seconds: number;
  completed_pct: number;
  completed: boolean;
  last_watched_at: string | null;
};

export type PortalMembership = {
  id: string;
  plan_name: string;
  status: string;
  start_date: string;
  current_period_end: string | null;
};

export type PortalRecentCheckin = {
  id: string;
  class_date: string;
  class_type: string | null;
  checked_in_at: string;
};

export type PortalGym = {
  name: string;
  slug: string;
};

export type PortalProduct = {
  id: string;
  name: string;
  description: string | null;
  product_type: string;
  price_cents: number;
  class_credits: number;
  validity_days: number | null;
  stripe_price_id: string | null;
};

// ─────────────────────────────────────────────
// Main data loader — single round-trip for the dashboard
// ─────────────────────────────────────────────

export type PortalDashboardData = {
  student: PortalStudent;
  gym: PortalGym;
  beltProgress: PortalBeltProgress | null;
  attendanceDays: PortalAttendanceDay[];
  badges: PortalBadge[];
  goal: PortalGoal;
  credits: PortalCredits;
  purchases: PortalPurchase[];
  instructionals: PortalInstructional[];
  memberships: PortalMembership[];
  recentCheckins: PortalRecentCheckin[];
  stats: {
    totalClasses: number;
    currentStreak: number;
    longestStreak: number;
    thisWeekClasses: number;
  };
};

export async function getPortalDashboard(
  studentId: string,
): Promise<PortalDashboardData | null> {
  const admin = createAdminClient() as any;

  // Fetch everything in parallel
  const [
    studentRes,
    beltRes,
    attendanceRes,
    badgesRes,
    goalRes,
    creditsRes,
    purchasesRes,
    instructionalPurchasesRes,
    membershipsRes,
  ] = await Promise.all([
    admin.from("students").select("id, full_name, email, belt_rank, status, join_date, gym_id").eq("id", studentId).maybeSingle(),
    admin.from("belt_progress").select("current_belt, stripes, progress_percentage").eq("student_id", studentId).maybeSingle(),
    admin.from("attendance").select("class_date, class_type, checked_in_at, id").eq("student_id", studentId).order("checked_in_at", { ascending: false }),
    admin.from("student_badges").select("id, badge_key, earned_at").eq("student_id", studentId).order("earned_at", { ascending: false }),
    admin.from("student_goals").select("weekly_target").eq("student_id", studentId).maybeSingle(),
    admin.from("student_credits").select("class_credits, gift_card_balance_cents").eq("student_id", studentId).maybeSingle(),
    admin.from("purchases").select("id, product_id, amount_cents, status, credits_granted, created_at, expires_at").eq("student_id", studentId).order("created_at", { ascending: false }),
    admin.from("instructional_purchases").select("instructional_id, status").eq("student_id", studentId).eq("status", "paid"),
    admin.from("memberships").select("id, plan_id, status, start_date, current_period_end").eq("student_id", studentId).order("created_at", { ascending: false }),
  ]);

  if (!studentRes.data) return null;
  const student = studentRes.data as PortalStudent;

  // Gym info
  const gymRes = await admin.from("gyms").select("name, slug").eq("id", student.gym_id).maybeSingle();

  // Build attendance heat map (last 84 days = 12 weeks)
  const eightyfourDaysAgo = new Date();
  eightyfourDaysAgo.setDate(eightyfourDaysAgo.getDate() - 84);
  const allAttendance = attendanceRes.data ?? [];
  const dayMap = new Map<string, number>();
  for (const row of allAttendance) {
    const d = row.class_date.slice(0, 10);
    dayMap.set(d, (dayMap.get(d) ?? 0) + 1);
  }
  const attendanceDays: PortalAttendanceDay[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    attendanceDays.push({ date: key, count: dayMap.get(key) ?? 0 });
  }

  // Stats
  const totalClasses = allAttendance.length;

  // Current streak (consecutive calendar days with ≥1 class, ending today/yesterday)
  const streakDates = new Set<string>(allAttendance.map((a: any) => a.class_date.slice(0, 10)));
  let currentStreak = 0;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  // Start from today; if no class today, start from yesterday
  let startDate = streakDates.has(todayStr) ? today : (() => { const d = new Date(today); d.setDate(d.getDate() - 1); return d; })();
  for (let i = 0; i < 365; i++) {
    const key = startDate.toISOString().slice(0, 10);
    if (!streakDates.has(key)) break;
    currentStreak++;
    startDate = new Date(startDate);
    startDate.setDate(startDate.getDate() - 1);
  }

  // Longest streak
  const sortedDates = [...streakDates as Set<string>].sort();
  let longest = 0;
  let run = 0;
  let prevDate: Date | null = null;
  for (const ds of sortedDates) {
    const d = new Date(ds);
    if (prevDate) {
      const diff = (d.getTime() - prevDate.getTime()) / 86400000;
      if (diff === 1) { run++; } else { run = 1; }
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prevDate = d;
  }

  // This week (Mon–Sun)
  const mon = new Date(today);
  mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  const thisWeekClasses = allAttendance.filter((a: any) => new Date(a.checked_in_at) >= mon).length;

  // Recent check-ins (last 20)
  const recentCheckins: PortalRecentCheckin[] = allAttendance.slice(0, 20).map((a: any) => ({
    id: a.id,
    class_date: a.class_date,
    class_type: a.class_type,
    checked_in_at: a.checked_in_at,
  }));

  // Memberships with plan names
  const planIds = [...new Set((membershipsRes.data ?? []).map((m: any) => m.plan_id))];
  const plansRes = planIds.length
    ? await admin.from("membership_plans").select("id, name").in("id", planIds)
    : { data: [] };
  const planMap = new Map((plansRes.data ?? []).map((p: any) => [p.id, p.name]));
  const memberships: PortalMembership[] = (membershipsRes.data ?? []).map((m: any) => ({
    id: m.id,
    plan_name: planMap.get(m.plan_id) ?? "Unknown plan",
    status: m.status,
    start_date: m.start_date,
    current_period_end: m.current_period_end,
  }));

  // Purchases with product names
  const productIds = [...new Set((purchasesRes.data ?? []).filter((p: any) => p.product_id).map((p: any) => p.product_id!))];
  const productsRes = productIds.length
    ? await admin.from("products").select("id, name").in("id", productIds)
    : { data: [] };
  const productMap = new Map((productsRes.data ?? []).map((p: any) => [p.id, p.name]));
  const purchases: PortalPurchase[] = (purchasesRes.data ?? []).map((p: any) => ({
    id: p.id,
    product_name: p.product_id ? (productMap.get(p.product_id) ?? null) : null,
    amount_cents: p.amount_cents,
    status: p.status,
    credits_granted: p.credits_granted,
    created_at: p.created_at,
    expires_at: p.expires_at,
  }));

  // Instructionals the student owns
  const ownedIds = (instructionalPurchasesRes.data ?? []).map((ip: any) => ip.instructional_id);
  let instructionals: PortalInstructional[] = [];
  if (ownedIds.length) {
    const [instrRes, watchRes] = await Promise.all([
      admin.from("instructionals").select("id, title, description, category, duration_seconds, thumbnail_url, video_url").in("id", ownedIds),
      admin.from("watch_progress").select("instructional_id, position_seconds, completed_pct, completed, last_watched_at").eq("student_id", studentId).in("instructional_id", ownedIds),
    ]);
    const watchMap = new Map((watchRes.data ?? []).map((w: any) => [w.instructional_id, w]));
    instructionals = (instrRes.data ?? []).map((i: any) => {
      const w = watchMap.get(i.id) as any;
      return {
        id: i.id,
        title: i.title,
        description: i.description,
        category: i.category,
        duration_seconds: i.duration_seconds,
        thumbnail_url: i.thumbnail_url,
        video_url: i.video_url,
        position_seconds: w?.position_seconds ?? 0,
        completed_pct: w?.completed_pct ?? 0,
        completed: w?.completed ?? false,
        last_watched_at: w?.last_watched_at ?? null,
      };
    });
  }

  return {
    student,
    gym: gymRes.data ?? { name: "Your Gym", slug: "" },
    beltProgress: beltRes.data
      ? {
          current_belt: beltRes.data.current_belt as BeltRank,
          stripes: beltRes.data.stripes,
          progress_percentage: beltRes.data.progress_percentage,
        }
      : null,
    attendanceDays,
    badges: (badgesRes.data ?? []) as PortalBadge[],
    goal: { weekly_target: goalRes.data?.weekly_target ?? 3 },
    credits: {
      class_credits: creditsRes.data?.class_credits ?? 0,
      gift_card_balance_cents: creditsRes.data?.gift_card_balance_cents ?? 0,
    },
    purchases,
    instructionals,
    memberships,
    recentCheckins,
    stats: { totalClasses, currentStreak, longestStreak: longest, thisWeekClasses },
  };
}

// ─────────────────────────────────────────────
// Gym product catalogue (for the shop page)
// ─────────────────────────────────────────────

export async function getGymProducts(
  gymId: string,
): Promise<PortalProduct[]> {
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("products")
    .select("id, name, description, product_type, price_cents, class_credits, validity_days, stripe_price_id")
    .eq("gym_id", gymId)
    .eq("visible", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as PortalProduct[];
}

// ─────────────────────────────────────────────
// Stripe billing portal for students
// ─────────────────────────────────────────────

export async function createStudentPortalSession(
  studentId: string,
  returnUrl: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const admin = createAdminClient() as any;

  // Get student's stripe customer id
  const { data: student } = await admin
    .from("students")
    .select("stripe_customer_id, gym_id")
    .eq("id", studentId)
    .maybeSingle();

  if (!student?.stripe_customer_id) {
    return { ok: false, error: "No billing account linked. Ask your gym to set up your billing." };
  }

  // Get gym's Stripe account id
  const { data: gym } = await admin
    .from("gyms")
    .select("stripe_account_id")
    .eq("id", student.gym_id)
    .maybeSingle();

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return { ok: false, error: "Billing is not configured for this gym." };
  }

  try {
    const stripeAccountId = gym?.stripe_account_id;
    const body = new URLSearchParams({
      customer: student.stripe_customer_id,
      return_url: returnUrl,
    });

    const resp = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(stripeAccountId ? { "Stripe-Account": stripeAccountId } : {}),
      },
      body: body.toString(),
    });

    if (!resp.ok) {
      const err = await resp.json();
      return { ok: false, error: err?.error?.message ?? "Failed to create billing session." };
    }

    const session = await resp.json();
    return { ok: true, url: session.url };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown error." };
  }
}

// ─────────────────────────────────────────────
// Stripe checkout for a single product
// ─────────────────────────────────────────────

export async function createProductCheckout(
  studentId: string,
  productId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const admin = createAdminClient() as any;

  const [{ data: student }, { data: product }] = await Promise.all([
    admin.from("students").select("stripe_customer_id, gym_id").eq("id", studentId).maybeSingle(),
    admin.from("products").select("id, name, stripe_price_id, price_cents, gym_id").eq("id", productId).maybeSingle(),
  ]);

  if (!product) return { ok: false, error: "Product not found." };

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) return { ok: false, error: "Billing is not configured." };
  if (!product.stripe_price_id) return { ok: false, error: "This product is not available for online purchase. Ask your gym to set it up." };

  const { data: gym } = await admin
    .from("gyms")
    .select("stripe_account_id")
    .eq("id", product.gym_id)
    .maybeSingle();

  try {
    const params = new URLSearchParams({
      mode: "payment",
      "line_items[0][price]": product.stripe_price_id,
      "line_items[0][quantity]": "1",
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(student?.stripe_customer_id ? { customer: student.stripe_customer_id } : {}),
      "metadata[student_id]": studentId,
      "metadata[product_id]": productId,
    });

    const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(gym?.stripe_account_id ? { "Stripe-Account": gym.stripe_account_id } : {}),
      },
      body: params.toString(),
    });

    if (!resp.ok) {
      const err = await resp.json();
      return { ok: false, error: err?.error?.message ?? "Failed to create checkout." };
    }

    const session = await resp.json();
    return { ok: true, url: session.url };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Unknown error." };
  }
}
