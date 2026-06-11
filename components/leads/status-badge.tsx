import { cn } from "@/lib/utils";
import { LEAD_STATUS_BADGE, LEAD_STATUS_LABEL } from "@/lib/leads";
import type { LeadStatus } from "@/lib/supabase/types";

export function LeadStatusBadge({
  status,
  className,
}: {
  status: LeadStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        LEAD_STATUS_BADGE[status],
        className,
      )}
    >
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}
