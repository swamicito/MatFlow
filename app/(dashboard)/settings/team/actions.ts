/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import {
  ROLE_LABEL,
  assignableRoles,
  can,
} from "@/lib/permissions";
import type { UserRole } from "@/lib/supabase/types";

export type TeamMember = {
  id: string;
  full_name: string | null;
  role: UserRole;
  phone: string | null;
  created_at: string;
};

export async function listTeam(): Promise<
  | { ok: true; members: TeamMember[]; gymId: string | null }
  | { ok: false; error: string }
> {
  const role = await getCurrentRole();
  if (!can(role, "view_team")) {
    return { ok: false, error: "You don't have permission to view the team." };
  }
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const query = supabase
    .from("profiles")
    .select("id, full_name, role, phone, created_at")
    .order("created_at", { ascending: true });
  const { data, error } = gymId
    ? await query.eq("gym_id", gymId)
    : await query;

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    members: (data ?? []) as TeamMember[],
    gymId,
  };
}

export async function setMemberRole(
  memberId: string,
  nextRole: UserRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const actorRole = await getCurrentRole();
  if (!can(actorRole, "manage_team")) {
    return {
      ok: false,
      error: "Only Owners can change roles.",
    };
  }
  if (!assignableRoles(actorRole).includes(nextRole)) {
    return { ok: false, error: `Cannot assign role "${ROLE_LABEL[nextRole]}".` };
  }
  const supabase = createAdminClient() as any;
  const { error } = await supabase
    .from("profiles")
    .update({ role: nextRole })
    .eq("id", memberId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/team");
  return { ok: true };
}
