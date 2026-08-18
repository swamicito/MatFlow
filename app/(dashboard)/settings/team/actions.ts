/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import { sendEmail } from "@/lib/messaging";
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
  | { ok: true; members: TeamMember[]; gymId: string }
  | { ok: false; error: string }
> {
  const role = await getCurrentRole();
  if (!can(role, "view_team")) {
    return { ok: false, error: "You don't have permission to view the team." };
  }
  const supabase = createAdminClient() as any;
  const gymId = await requireGymId();

  const [profilesRes, linksRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, phone, created_at")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: true }),
    supabase
      .from("user_gyms")
      .select("user_id, role")
      .eq("gym_id", gymId),
  ]);

  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };
  if (linksRes.error) return { ok: false, error: linksRes.error.message };

  // Members come from two sources: profiles with this primary gym, and
  // user_gyms links (a user's primary gym may be elsewhere). user_gyms role
  // is the gym-specific one and wins.
  const byId = new Map<string, TeamMember>();
  for (const p of profilesRes.data ?? []) {
    byId.set(p.id, p as TeamMember);
  }

  const links = linksRes.data ?? [];
  const missingIds = links.map((l: any) => l.user_id).filter((id: string) => !byId.has(id));
  const extraProfiles = new Map<
    string,
    { full_name: string | null; phone: string | null; created_at: string }
  >();
  if (missingIds.length > 0) {
    const { data: extras } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at")
      .in("id", missingIds);
    for (const p of extras ?? []) extraProfiles.set(p.id, p);
  }

  for (const l of links) {
    const existing = byId.get(l.user_id);
    const prof = extraProfiles.get(l.user_id);
    byId.set(l.user_id, {
      id: l.user_id,
      full_name: existing?.full_name ?? prof?.full_name ?? null,
      role: l.role,
      phone: existing?.phone ?? prof?.phone ?? null,
      created_at: existing?.created_at ?? prof?.created_at ?? new Date().toISOString(),
    });
  }

  const members = [...byId.values()].sort((a, b) =>
    a.created_at < b.created_at ? -1 : 1,
  );
  return { ok: true, members, gymId };
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
  const gymId = await requireGymId();

  // Gym-specific role lives in user_gyms.
  const { error: linkErr } = await supabase
    .from("user_gyms")
    .upsert(
      { user_id: memberId, gym_id: gymId, role: nextRole },
      { onConflict: "user_id,gym_id" },
    );
  if (linkErr) return { ok: false, error: linkErr.message };

  // Keep profiles.role in sync only when this gym is their primary gym.
  const { error: profErr } = await supabase
    .from("profiles")
    .update({ role: nextRole })
    .eq("id", memberId)
    .eq("gym_id", gymId);
  if (profErr) return { ok: false, error: profErr.message };

  revalidatePath("/settings/team");
  return { ok: true };
}

// ─── Invite ──────────────────────────────────────────────────────────────────

async function getOrCreateAuthUser(
  supabase: any,
  email: string,
): Promise<string> {
  // Strategy 1: createUser
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (created?.user?.id) return created.user.id as string;

  // Strategy 2: generateLink creates the user if missing
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkData?.user?.id) return linkData.user.id as string;

  // Strategy 3: paginated lookup (user may already exist)
  for (let page = 1; page <= 10; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    const found = users.find(
      (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (found?.id) return found.id as string;
    if (users.length < 1000) break;
  }

  throw new Error(
    `Could not get-or-create auth user: ${createErr?.message ?? "unknown"}`,
  );
}

export async function inviteTeamMember(
  email: string,
  role: UserRole,
  fullName?: string,
): Promise<{ ok: true; emailed: boolean } | { ok: false; error: string }> {
  const actorRole = await getCurrentRole();
  if (!can(actorRole, "manage_team")) {
    return { ok: false, error: "Only Owners can invite team members." };
  }
  if (!assignableRoles(actorRole).includes(role)) {
    return { ok: false, error: `Cannot assign role "${ROLE_LABEL[role]}".` };
  }

  const normalized = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const supabase = createAdminClient() as any;
  const gymId = await requireGymId();

  const { data: gym } = await supabase
    .from("gyms")
    .select("name")
    .eq("id", gymId)
    .maybeSingle();
  const gymName = gym?.name ?? "your gym";

  let userId: string;
  try {
    userId = await getOrCreateAuthUser(supabase, normalized);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Auth user creation failed." };
  }

  // Link to THIS gym only.
  const { error: linkErr } = await supabase
    .from("user_gyms")
    .upsert(
      { user_id: userId, gym_id: gymId, role },
      { onConflict: "user_id,gym_id" },
    );
  if (linkErr) return { ok: false, error: `Failed to link member: ${linkErr.message}` };

  // Profile: set primary gym only if the profile has none — never steal a
  // user away from another gym's primary.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, gym_id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    const { error: pErr } = await supabase.from("profiles").insert({
      id: userId,
      gym_id: gymId,
      role,
      full_name: fullName?.trim() || normalized,
    });
    if (pErr) return { ok: false, error: `Failed to create profile: ${pErr.message}` };
  } else {
    const patch: Record<string, string> = {};
    if (!profile.gym_id) patch.gym_id = gymId;
    if (fullName?.trim()) patch.full_name = fullName.trim();
    if (Object.keys(patch).length > 0) {
      const { error: pErr } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", userId);
      if (pErr) return { ok: false, error: `Failed to update profile: ${pErr.message}` };
    }
  }

  // Welcome email with a magic link (best-effort — member can also just use /login).
  let emailed = false;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mat-flow.net";
  const { data: linkData } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
    options: { redirectTo: `${site}/auth/callback?next=/dashboard` },
  });
  const magicLink = linkData?.properties?.action_link ?? `${site}/login`;

  const result = await sendEmail({
    to: normalized,
    fromName: "MatFlow",
    subject: `You've been added to ${gymName} on MatFlow`,
    body: [
      `Hi${fullName?.trim() ? ` ${fullName.trim()}` : ""},`,
      ``,
      `${gymName} has added you as ${ROLE_LABEL[role]} on MatFlow.`,
      ``,
      `Sign in (no password needed):`,
      magicLink,
      ``,
      `If the link has expired, go to ${site}/login and enter this email address to get a fresh one.`,
    ].join("\n"),
  });
  emailed = result.ok && result.status === "sent";

  revalidatePath("/settings/team");
  return { ok: true, emailed };
}
