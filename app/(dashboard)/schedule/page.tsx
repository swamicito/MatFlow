import { getCurrentGymId } from "@/lib/auth/current-gym";
import { listClasses } from "@/app/(dashboard)/schedule/actions";
import { ScheduleView } from "@/components/schedule/schedule-view";

export default async function SchedulePage() {
  const gymId = await getCurrentGymId();
  const classes = gymId ? await listClasses(gymId) : [];

  return <ScheduleView gymId={gymId ?? ""} classes={classes} />;
}
