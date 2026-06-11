import { listClasses } from "@/app/(dashboard)/schedule/actions";
import type { ClassWithBooking } from "@/app/(dashboard)/schedule/actions";
import { PortalSchedule } from "@/components/portal/portal-schedule";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function PortalSchedulePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;

  const { data: gym } = await admin
    .from("gyms")
    .select("id")
    .eq("slug", "asbury-park")
    .maybeSingle();

  const gymId: string | null = gym?.id ?? null;

  const classRows = gymId ? await listClasses(gymId) : [];
  const classes: ClassWithBooking[] = classRows.map((c) => ({
    ...c,
    is_booked: false,
  }));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Class Schedule</h1>
        <p className="text-[#888] mt-1">
          Asbury Park Jiu-Jitsu • Tap any class to sign up
        </p>
      </div>
      <PortalSchedule classes={classes} myBookings={[]} studentId="" />
    </div>
  );
}
