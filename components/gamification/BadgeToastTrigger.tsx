"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { UserBadge } from "@/lib/gamification/types";

type Props = {
  newBadges: UserBadge[];
  dailyBonus?: boolean;
};

/**
 * Renders nothing. On mount, fires sonner toasts for:
 *   1. Daily login bonus (if `dailyBonus` is true) — shown below badges.
 *   2. Newly-earned badges (from `checkAndAwardBadges`) — shown on top.
 *
 * Sonner stacks toasts LIFO, so calling daily bonus first puts it at the
 * bottom of the stack while badge toasts appear more prominently above it.
 *
 * `useEffect` dep array is intentionally empty — fires once on mount only.
 */
export function BadgeToastTrigger({ newBadges, dailyBonus = false }: Props) {
  useEffect(() => {
    // Daily login bonus — celebratory but brief
    if (dailyBonus) {
      toast.success("☀️ Daily Login Bonus — +5 pts!", {
        description: "Keep the streak going. See you tomorrow!",
        duration: 5000,
      });
    }

    // Badge unlocks — shown above the daily bonus in Sonner's LIFO stack.
    // Cap: up to 3 individual toasts (one per badge); 4+ collapses into one.
    if (newBadges.length === 0) {
      // nothing
    } else if (newBadges.length <= 3) {
      for (const ub of newBadges) {
        const name = ub.badge?.name ?? "New Badge";
        const icon = ub.badge?.icon ?? "🏅";
        const desc = ub.badge?.description ?? "Keep training to earn more.";
        toast.success(`${icon} Badge Unlocked: ${name}!`, {
          description: desc,
          duration: 6000,
        });
      }
    } else {
      toast.success(`🎉 ${newBadges.length} New Badges Unlocked!`, {
        description: newBadges
          .map((ub) => `${ub.badge?.icon ?? "🏅"} ${ub.badge?.name ?? "Badge"}`)
          .join(" · "),
        duration: 7000,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — fire once on mount only

  return null;
}
