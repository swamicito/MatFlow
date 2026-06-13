import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/types";

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

// Kept as a named export so existing imports (checkin-client.tsx) don't break.
void (null as unknown as Attendance);

export default function CheckinPage() {
  redirect("/tablet");
}

