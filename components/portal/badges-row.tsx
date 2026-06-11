"use client";

import type { PortalBadge } from "@/app/portal/actions";
import { BADGE_META } from "@/lib/portal-utils";

export function BadgesRow({ badges }: { badges: PortalBadge[] }) {
  if (badges.length === 0) {
    return (
      <p className="text-xs text-[#444] py-2">
        No badges yet. Keep training to earn your first!
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((b) => {
        const meta = BADGE_META[b.badge_key] ?? {
          label: b.badge_key,
          emoji: "🏅",
          description: "",
        };
        return (
          <div
            key={b.id}
            title={`${meta.label} — ${meta.description}\nEarned ${new Date(b.earned_at).toLocaleDateString()}`}
            className="flex items-center gap-1.5 rounded-full border border-[#222] bg-[#111] px-3 py-1.5 text-xs"
          >
            <span>{meta.emoji}</span>
            <span className="text-[#ccc]">{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}
