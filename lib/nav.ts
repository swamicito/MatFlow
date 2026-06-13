import {
  LayoutDashboard,
  UserPlus,
  Users,
  CalendarDays,
  CreditCard,
  BarChart3,
  Settings,
  MessageSquare,
  MonitorSmartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  requires: Permission;
  rightIcon?: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requires: "view_dashboard" },
  { label: "Leads", href: "/leads", icon: UserPlus, requires: "view_leads" },
  { label: "Students", href: "/students", icon: Users, requires: "view_students" },
  { label: "Schedule", href: "/schedule", icon: CalendarDays, requires: "view_schedule" },
  { label: "Billing", href: "/billing", icon: CreditCard, requires: "view_billing" },
  { label: "Reports", href: "/reports", icon: BarChart3, requires: "view_reports" },
  { label: "Messages", href: "/messages", icon: MessageSquare, requires: "view_messages" },
  { label: "Settings", href: "/settings", icon: Settings, requires: "view_settings" },
  { label: "Front Desk", href: "/frontdesk", icon: MonitorSmartphone, requires: "view_checkin", rightIcon: Tablet },
];
