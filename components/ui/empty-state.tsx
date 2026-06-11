import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reusable empty-state panel used across the app.
 * Keeps the black-and-white minimalist language consistent.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#1f1f1f] bg-[#0a0a0a] px-6 py-14 text-center",
        className,
      )}
    >
      <div className="h-12 w-12 grid place-items-center rounded-full border border-[#222] bg-black text-[#555]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-medium text-white">{title}</p>
        {description && (
          <p className="text-xs text-[#666] leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/**
 * Inline skeleton-style row placeholder for tables.
 */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-[#1a1a1a]">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-4 rounded bg-[#1a1a1a] animate-pulse"
                style={{ width: `${55 + ((i * cols + j) % 4) * 10}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
