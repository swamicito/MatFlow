import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { listClassesForStudent, listMyBookings } from "@/app/(dashboard)/schedule/actions";
import { PortalSchedule } from "@/components/portal/portal-schedule";
import { createAdminClient } from "@/lib/supabase/admin";
import { CalendarDays } from "lucide-react";

export default async function PortalSchedulePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const identity = await getCurrentStudentIdentity();

  if (!identity) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <CalendarDays className="h-8 w-8 text-[#555]" />
        <p className="text-sm text-[#9CA3AF]">Sign in to view the class schedule.</p>
      </div>
    );
  }

  const { data: student } = await admin
    .from("students")
    .select("gym_id")
    .eq("id", identity.studentId)
    .maybeSingle();

  const gymId: string | null = student?.gym_id ?? null;

  let gymName = "Your Gym";
  if (gymId) {
    const { data: gym } = await admin.from("gyms").select("name").eq("id", gymId).maybeSingle();
    gymName = gym?.name ?? "Your Gym";
  }

  const [classes, myBookings] = gymId
    ? await Promise.all([
        listClassesForStudent(gymId, identity.studentId),
        listMyBookings(identity.studentId, gymId),
      ])
    : [[], []];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Class Schedule</h1>
        <p className="text-[#9CA3AF] mt-1">{gymName} · Tap any class to sign up</p>
      </div>
      <PortalSchedule classes={classes} myBookings={myBookings} studentId={identity.studentId} />
    </div>
  );
}
