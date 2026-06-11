import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { getAutomationState } from "@/app/(dashboard)/settings/automation/actions";
import { AutomationClient } from "@/components/automation/automation-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Automation · MatFlow" };

export default async function AutomationPage() {
  const state = await getAutomationState();

  if (!state) {
    return (
      <div className="space-y-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Settings
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Automation
        </h1>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3 text-sm text-amber-200">
          <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Automation tables not found.</p>
            <p className="text-amber-200/80 mt-1">
              Apply migration{" "}
              <code className="font-mono">0005_automation.sql</code> to enable
              the automation engine.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>
      <AutomationClient initial={state} />
    </div>
  );
}
