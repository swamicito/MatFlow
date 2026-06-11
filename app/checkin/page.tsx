/* eslint-disable @typescript-eslint/no-explicit-any */
import { CheckinClient } from "@/components/checkin/checkin-client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

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

export default async function CheckinPage() {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const studentIds = gymId
    ? ((await supabase.from("students").select("id").eq("gym_id", gymId)).data ?? []).map((s: any) => s.id)
    : null;

  const [studentsRes, attendanceRes, recentRes] = await Promise.all([
    gymId
      ? supabase.from("students").select("id, full_name, phone, belt_rank, status").eq("gym_id", gymId).order("full_name", { ascending: true })
      : supabase.from("students").select("id, full_name, phone, belt_rank, status").order("full_name", { ascending: true }),
    studentIds
      ? supabase.from("attendance").select("student_id, checked_in_at").in("student_id", studentIds).order("checked_in_at", { ascending: false })
      : supabase.from("attendance").select("student_id, checked_in_at").order("checked_in_at", { ascending: false }),
    studentIds
      ? supabase.from("attendance").select("id, student_id, class_type, checked_in_at").in("student_id", studentIds).gte("checked_in_at", thirtyMinAgo).order("checked_in_at", { ascending: false }).limit(20)
      : supabase.from("attendance").select("id, student_id, class_type, checked_in_at").gte("checked_in_at", thirtyMinAgo).order("checked_in_at", { ascending: false }).limit(20),
  ]);

  const error =
    studentsRes.error ?? attendanceRes.error ?? recentRes.error ?? null;

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-semibold">Check-In</h1>
        <p className="text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2 mt-4">
          Failed to load: {error.message}
        </p>
      </div>
    );
  }

  // Latest check-in per student
  const latestByStudent: Record<string, string> = {};
  for (const a of attendanceRes.data ?? []) {
    if (!latestByStudent[a.student_id]) {
      latestByStudent[a.student_id] = a.checked_in_at;
    }
  }

  const students: CheckinStudent[] = (studentsRes.data ?? []).map((s: any) => ({
    ...(s as Student),
    last_checked_in_at: latestByStudent[s.id] ?? null,
  }));

  // Recent check-ins → resolve names from the students list we already have
  const nameById = new Map<string, string>();
  for (const s of studentsRes.data ?? []) nameById.set(s.id, s.full_name);

  const recent: RecentCheckin[] = ((recentRes.data ?? []) as Attendance[]).map(
    (a) => ({
      attendance_id: a.id,
      student_id: a.student_id,
      student_name: nameById.get(a.student_id) ?? "Unknown",
      class_type: a.class_type,
      checked_in_at: a.checked_in_at,
    }),
  );

  return <CheckinClient students={students} recent={recent} />;
}
