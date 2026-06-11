/* eslint-disable @typescript-eslint/no-explicit-any */
import { LeadsTable } from "@/components/leads/leads-table";
import { NewLeadDialog } from "@/components/leads/new-lead-dialog";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const [leadsRes, familiesRes] = await Promise.all([
    gymId
      ? supabase.from("leads").select("*").eq("gym_id", gymId).order("created_at", { ascending: false })
      : supabase.from("leads").select("*").order("created_at", { ascending: false }),
    gymId
      ? supabase.from("family_accounts").select("*").eq("gym_id", gymId).order("parent_name", { ascending: true })
      : supabase.from("family_accounts").select("*").order("parent_name", { ascending: true }),
  ]);

  const error = leadsRes.error ?? familiesRes.error;

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-2">Leads</h1>
        <div className="text-red-500">Failed to load leads: {error.message}</div>
      </div>
    );
  }

  const leads = leadsRes.data ?? [];
  const families = familiesRes.data ?? [];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-gray-400">
            Every prospect, from Webflow to walk-in. {leads.length} total.
          </p>
        </div>
        <NewLeadDialog />
      </div>

      <LeadsTable leads={leads} families={families} />
    </div>
  );
}
