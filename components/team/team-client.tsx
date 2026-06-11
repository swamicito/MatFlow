"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setMemberRole,
  type TeamMember,
} from "@/app/(dashboard)/settings/team/actions";
import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  assignableRoles,
  can,
} from "@/lib/permissions";
import type { UserRole } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

const ROLE_BADGE: Record<UserRole, string> = {
  owner: "border-emerald-500/50 bg-emerald-500/10 text-emerald-300",
  admin: "border-sky-500/50 bg-sky-500/10 text-sky-300",
  instructor: "border-amber-500/50 bg-amber-500/10 text-amber-200",
  front_desk: "border-[#333] bg-[#0a0a0a] text-[#ccc]",
};

const ALL_ROLES: UserRole[] = ["owner", "admin", "instructor", "front_desk"];

export function TeamClient({
  initialMembers,
  currentRole,
}: {
  initialMembers: TeamMember[];
  currentRole: UserRole;
}) {
  const [members, setMembers] = useState(initialMembers);
  const canManage = can(currentRole, "manage_team");

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Team &amp; Roles
          </h1>
          <p className="text-sm text-[#aaa] mt-1">
            {canManage
              ? "Assign roles to your staff. Each role controls which screens and actions they can access."
              : "View-only — only Owners can change roles."}
          </p>
        </div>
      </header>

      <RoleLegend />

      <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="p-8">
              <EmptyState />
            </div>
          ) : (
            <ul className="divide-y divide-[#161616]">
              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  canManage={canManage}
                  onUpdated={(role) =>
                    setMembers((prev) =>
                      prev.map((p) =>
                        p.id === m.id ? { ...p, role } : p,
                      ),
                    )
                  }
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────── Legend ───────────────────

function RoleLegend() {
  return (
    <Card className="bg-[#0a0a0a] border-[#1f1f1f] shadow-none">
      <CardContent className="p-6 space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-[#666]">
          Role permissions
        </p>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ALL_ROLES.map((r) => (
            <li
              key={r}
              className="rounded-md border border-[#1f1f1f] bg-black p-4"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest",
                    ROLE_BADGE[r],
                  )}
                >
                  <ShieldCheck className="h-3 w-3" />
                  {ROLE_LABEL[r]}
                </span>
              </div>
              <p className="text-xs text-[#aaa] leading-relaxed">
                {ROLE_DESCRIPTION[r]}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────── Member row ───────────────────

function MemberRow({
  member,
  canManage,
  onUpdated,
}: {
  member: TeamMember;
  canManage: boolean;
  onUpdated: (role: UserRole) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const assignable = canManage ? assignableRoles("owner") : [];

  function change(next: string | null) {
    if (!next || next === member.role) return;
    const previous = member.role;
    onUpdated(next as UserRole);
    startTransition(async () => {
      const r = await setMemberRole(member.id, next as UserRole);
      if (!r.ok) {
        toast.error("Couldn't change role", { description: r.error });
        onUpdated(previous);
        return;
      }
      toast.success(
        `${member.full_name ?? "Member"} is now ${ROLE_LABEL[next as UserRole]}`,
      );
      router.refresh();
    });
  }

  return (
    <li className="px-6 py-4 flex items-center gap-4 flex-wrap">
      <div className="h-10 w-10 grid place-items-center rounded-full border border-[#222] bg-black text-[#aaa] shrink-0">
        <UserCircle2 className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm font-medium text-white">
          {member.full_name ?? "Unnamed user"}
        </p>
        <p className="text-xs text-[#666] mt-0.5 truncate">
          {member.phone ?? "No phone on file"}
          <span className="mx-1.5 text-[#333]">·</span>
          Joined {new Date(member.created_at).toLocaleDateString()}
        </p>
      </div>
      {canManage ? (
        <Select
          value={member.role}
          onValueChange={change}
          disabled={pending}
        >
          <SelectTrigger className="h-9 w-44 bg-black border-[#222] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0a0a0a] border-[#1f1f1f] text-white">
            {assignable.map((r) => (
              <SelectItem
                key={r}
                value={r}
                className="focus:bg-[#111] focus:text-white"
              >
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] uppercase tracking-widest",
            ROLE_BADGE[member.role],
          )}
        >
          <Lock className="h-3 w-3" />
          {ROLE_LABEL[member.role]}
        </span>
      )}
    </li>
  );
}

// ─────────────────── Empty state ───────────────────

function EmptyState() {
  return (
    <div className="rounded-md border border-dashed border-[#222] bg-black px-4 py-12 text-center text-sm text-[#aaa]">
      <UserCircle2 className="h-8 w-8 mx-auto text-[#444]" />
      <p className="mt-3 text-white">No team members yet.</p>
      <p className="text-xs text-[#666] mt-1">
        When you connect Supabase Auth, signed-up staff will appear here for
        role assignment.
      </p>
    </div>
  );
}
