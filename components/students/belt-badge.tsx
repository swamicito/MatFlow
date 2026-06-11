import { cn } from "@/lib/utils";
import { BELT_BADGE, BELT_LABEL } from "@/lib/students";
import type { BeltRank } from "@/lib/supabase/types";

export function BeltBadge({
  belt,
  stripes = 0,
  className,
}: {
  belt: BeltRank;
  stripes?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        BELT_BADGE[belt],
        className,
      )}
    >
      <span>{BELT_LABEL[belt]}</span>
      {stripes > 0 && (
        <span className="flex items-center gap-0.5">
          {Array.from({ length: stripes }).map((_, i) => (
            <span
              key={i}
              className="h-1 w-1 rounded-full bg-current opacity-80"
            />
          ))}
        </span>
      )}
    </span>
  );
}
