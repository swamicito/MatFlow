/* eslint-disable @typescript-eslint/no-explicit-any */
import { FrontdeskClient } from "@/components/frontdesk/frontdesk-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Front Desk · MatFlow" };

// ── Types ────────────────────────────────────────────────────────────────────

type Student = Database["public"]["Tables"]["students"]["Row"];

export type FrontdeskClass = {
  id: string;
  title: string;
  instructor_name: string;
  start_time: string;
  end_time: string;
};

export type CheckinStudent = Pick<
  Student,
  "id" | "full_name" | "phone" | "belt_rank" | "status"
> & {
  last_checked_in_at: string | null;
};

export type RecentCheckin = {
  attendance_id: string;
  student_id: string;
  student_name: string;
  class_type: string | null;
  checked_in_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function FrontdeskPage() {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const todayDow = new Date().getDay();
  const iso = todayIso();
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  let students: CheckinStudent[] = [];
  let todaysClasses: FrontdeskClass[] = [];
  let recentCheckins: RecentCheckin[] = [];
  let todayCount = 0;
  let activeStudents = 0;
  let gymName = "MatFlow";

  if (gymId) {
    const [gymRes, studentsRes, classesRes] = await Promise.all([
      supabase.from("gyms").select("name").eq("id", gymId).maybeSingle(),
      supabase
        .from("students")
        .select("id, full_name, phone, belt_rank, status")
        .eq("gym_id", gymId)
        .in("status", ["active", "trial"])
        .order("full_name"),
      supabase
        .from("classes")
        .select("id, title, instructor_name, start_time, end_time")
        .eq("gym_id", gymId)
        .eq("day_of_week", todayDow)
        .order("start_time"),
    ]);

    gymName = gymRes.data?.name ?? gymName;
    todaysClasses = classesRes.data ?? [];

    const studentRows: any[] = studentsRes.data ?? [];
    const studentIds: string[] = studentRows.map((s) => s.id);
    activeStudents = studentRows.filter((s) => s.status === "active").length;

    if (studentIds.length > 0) {
      const [attendanceRes, recentRes, countRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("student_id, checked_in_at")
          .in("student_id", studentIds)
          .order("checked_in_at", { ascending: false }),
        supabase
          .from("attendance")
          .select("id, student_id, class_type, checked_in_at")
          .in("student_id", studentIds)
          .gte("checked_in_at", thirtyMinAgo)
          .order("checked_in_at", { ascending: false })
          .limit(15),
        supabase
          .from("attendance")
          .select("id", { count: "exact", head: true })
          .in("student_id", studentIds)
          .eq("class_date", iso),
      ]);

      const latestByStudent: Record<string, string> = {};
      for (const a of attendanceRes.data ?? []) {
        if (!latestByStudent[a.student_id]) {
          latestByStudent[a.student_id] = a.checked_in_at;
        }
      }

      const nameById = new Map<string, string>(
        studentRows.map((s) => [s.id, s.full_name]),
      );

      students = studentRows.map((s) => ({
        ...s,
        last_checked_in_at: latestByStudent[s.id] ?? null,
      }));

      recentCheckins = (recentRes.data ?? []).map((a: any) => ({
        attendance_id: a.id,
        student_id: a.student_id,
        student_name: nameById.get(a.student_id) ?? "Unknown",
        class_type: a.class_type,
        checked_in_at: a.checked_in_at,
      }));

      todayCount = countRes.count ?? 0;
    } else {
      students = studentRows.map((s) => ({ ...s, last_checked_in_at: null }));
    }
  }

  return (
    <FrontdeskClient
      students={students}
      todaysClasses={todaysClasses}
      recentCheckins={recentCheckins}
      stats={{ todayCount, activeStudents }}
      gymName={gymName}
    />
  );
}
