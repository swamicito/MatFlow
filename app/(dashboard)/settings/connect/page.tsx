import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import { getConnectState } from "./actions";
import { ConnectClient } from "@/components/settings/connect-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments · MatFlow" };

export default async function ConnectPage() {
  const role = await getCurrentRole();
  if (!can(role, "edit_billing")) redirect("/settings");

  const state = await getConnectState();

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-[#aaa] mt-1">
          Connect your Stripe account to accept payments from your students.
        </p>
      </div>

      <Suspense fallback={null}>
        <ConnectClient initialState={state} canManage={can(role, "edit_billing")} />
      </Suspense>
    </div>
  );
}
