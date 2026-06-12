import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";

/* eslint-disable @typescript-eslint/no-explicit-any */

const PLANS = [
  {
    name: "Unlimited Monthly",
    price_cents: 18900,
    interval: "month",
    description: "Unlimited classes for adults",
  },
  {
    name: "Kids Unlimited",
    price_cents: 12900,
    interval: "month",
    description: "Unlimited classes for kids",
  },
  {
    name: "Drop-In 10 Pack",
    price_cents: 15000,
    interval: "week",
    description: "10 class pack",
  },
  {
    name: "Unlimited Monthly - Family",
    price_cents: 27900,
    interval: "month",
    description: "Family plan covering up to 4 members",
  },
] as const;

export async function GET() {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) {
    return NextResponse.json({ ok: false, error: "No active gym found." }, { status: 400 });
  }

  // Load existing plans so we can skip duplicates
  const { data: existing } = await supabase
    .from("membership_plans")
    .select("name")
    .eq("gym_id", gymId);

  const existingNames = new Set(
    (existing ?? []).map((p: any) => p.name.toLowerCase().trim()),
  );

  const created: string[] = [];
  const skipped: string[] = [];

  for (const plan of PLANS) {
    if (existingNames.has(plan.name.toLowerCase())) {
      skipped.push(plan.name);
      continue;
    }
    const { error } = await supabase.from("membership_plans").insert({
      gym_id: gymId,
      name: plan.name,
      price_cents: plan.price_cents,
      interval: plan.interval,
      description: plan.description,
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: `Failed to create "${plan.name}": ${error.message}` },
        { status: 500 },
      );
    }
    created.push(plan.name);
  }

  return NextResponse.json({ ok: true, created, skipped });
}
