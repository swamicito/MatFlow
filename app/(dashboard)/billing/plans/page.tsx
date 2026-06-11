/* eslint-disable @typescript-eslint/no-explicit-any */
import { AlertCircle } from "lucide-react";
import { PlansClient } from "@/components/billing/plans-client";
import { isStripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const { data, error } = gymId
    ? await supabase.from("membership_plans").select("*").eq("gym_id", gymId).order("price_cents", { ascending: true })
    : await supabase.from("membership_plans").select("*").order("price_cents", { ascending: true });

  if (error) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Membership Plans
        </h1>
        <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
          Failed to load plans: {error.message}
        </p>
      </div>
    );
  }

  const stripeReady = isStripeConfigured();

  return (
    <div className="space-y-6">
      {!stripeReady && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Stripe not configured.</p>
            <p className="text-amber-300/80">
              Plans can be created and edited locally, but Stripe Products /
              Prices won&apos;t be created until you set{" "}
              <code className="font-mono">STRIPE_SECRET_KEY</code> in{" "}
              <code className="font-mono">.env.local</code>. Existing plans
              will lazily sync on the next subscribe.
            </p>
          </div>
        </div>
      )}
      <PlansClient plans={data ?? []} />
    </div>
  );
}
