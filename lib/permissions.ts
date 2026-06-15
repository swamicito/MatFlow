import type { UserRole } from "@/lib/supabase/types";

/**
 * Single source of truth for what each role can do.
 *
 * Add a new permission by:
 *   1. Adding it to the `Permission` union below.
 *   2. Listing the roles that should have it in ROLE_PERMISSIONS.
 *   3. Calling `can(role, "your_perm")` in the UI / page guard.
 */

export type Permission =
  // Page access
  | "view_dashboard"
  | "view_leads"
  | "view_students"
  | "view_schedule"
  | "view_billing"
  | "view_reports"
  | "view_checkin"
  | "view_settings"
  | "view_automation"
  | "view_import"
  | "view_onboarding"
  | "view_team"
  // Mutations
  | "edit_students"
  | "edit_students_advanced" // memberships, families, waivers, custom pricing
  | "edit_belt_progress"
  | "edit_leads"
  | "edit_billing"
  | "edit_settings"
  | "edit_automation"
  | "run_import"
  | "manage_team" // change roles
  | "manage_demo_data"
  | "view_shop"
  | "edit_shop"
  | "view_ondemand"
  | "edit_ondemand"
  | "view_messages"
  | "send_messages"
  | "delete_thread";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    "view_dashboard",
    "view_leads",
    "view_students",
    "view_schedule",
    "view_billing",
    "view_reports",
    "view_checkin",
    "view_settings",
    "view_automation",
    "view_import",
    "view_onboarding",
    "view_team",
    "edit_students",
    "edit_students_advanced",
    "edit_belt_progress",
    "edit_leads",
    "edit_billing",
    "edit_settings",
    "edit_automation",
    "run_import",
    "manage_team",
    "manage_demo_data",
    "view_shop",
    "edit_shop",
    "view_ondemand",
    "edit_ondemand",
    "view_messages",
    "send_messages",
    "delete_thread",
  ],
  admin: [
    "view_dashboard",
    "view_leads",
    "view_students",
    "view_schedule",
    "view_billing",
    "view_reports",
    "view_checkin",
    "view_settings",
    "view_automation",
    "view_import",
    "view_onboarding",
    "view_team",
    "edit_students",
    "edit_students_advanced",
    "edit_belt_progress",
    "edit_leads",
    "edit_billing",
    "edit_settings",
    "edit_automation",
    "run_import",
    "manage_demo_data",
    "view_shop",
    "edit_shop",
    "view_ondemand",
    "edit_ondemand",
    "view_messages",
    "send_messages",
    "delete_thread",
  ],
  instructor: [
    "view_dashboard",
    "view_students",
    "view_schedule",
    "view_reports",
    "view_checkin",
    "edit_belt_progress",
    "view_shop",
    "view_ondemand",
    "edit_ondemand",
    "view_messages",
    "send_messages",
  ],
  front_desk: [
    "view_dashboard",
    "view_leads",
    "view_students",
    "view_schedule",
    "view_checkin",
    "edit_leads",
    "edit_students",
    "view_shop",
    "edit_shop",
    "view_ondemand",
    "view_messages",
    "send_messages",
  ],
};

export function can(role: UserRole, perm: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(perm) ?? false;
}

export function canAny(role: UserRole, perms: Permission[]): boolean {
  return perms.some((p) => can(role, p));
}

// ─────────────────── Role metadata ───────────────────

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Owner",
  admin: "Admin",
  instructor: "Instructor",
  front_desk: "Front Desk",
};

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  owner:
    "Full access to everything: students, leads, billing, reports, settings, automation, import, and team management.",
  admin:
    "Same as Owner, but can't change other users' roles. Useful for senior staff who help run the academy.",
  instructor:
    "Dashboard, students roster, schedule, reports, tablet check-in, and belt progression. No access to billing, leads, settings, automation, or import.",
  front_desk:
    "Dashboard, leads (full edit), students (basic edit), schedule, and tablet check-in. No access to billing, reports, settings, automation, or import.",
};

/**
 * Roles a given role is allowed to assign to others.
 * Owners can assign any role; nobody else can change roles.
 */
export function assignableRoles(actor: UserRole): UserRole[] {
  if (actor === "owner") return ["owner", "admin", "instructor", "front_desk"];
  return [];
}

// ─────────────────── Route guards ───────────────────

/**
 * Map of route prefix → permission required to view it. Used by the
 * dashboard layout and middleware-style guards.
 */
export const ROUTE_PERMISSIONS: { prefix: string; perm: Permission }[] = [
  { prefix: "/leads", perm: "view_leads" },
  { prefix: "/billing", perm: "view_billing" },
  { prefix: "/reports", perm: "view_reports" },
  { prefix: "/frontdesk", perm: "view_checkin" },
  { prefix: "/settings/automation", perm: "view_automation" },
  { prefix: "/settings/import", perm: "view_import" },
  { prefix: "/settings/team", perm: "view_team" },
  { prefix: "/settings", perm: "view_settings" },
  { prefix: "/onboarding", perm: "view_onboarding" },
  { prefix: "/students", perm: "view_students" },
  { prefix: "/schedule", perm: "view_schedule" },
  { prefix: "/dashboard", perm: "view_dashboard" },
  { prefix: "/messages", perm: "view_messages" },
];

export function permissionForPath(pathname: string): Permission | null {
  // Match most specific (longest) prefix first.
  const sorted = [...ROUTE_PERMISSIONS].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );
  for (const { prefix, perm } of sorted) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) {
      return perm;
    }
  }
  return null;
}
