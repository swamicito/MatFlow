import { redirect } from "next/navigation";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getPortalDashboard } from "./actions";
import { PortalHome } from "@/components/portal/portal-home";

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  const identity = await getCurrentStudentIdentity();
  if (!identity) redirect("/login");

  const data = await getPortalDashboard(identity.studentId);
  if (!data) redirect("/login?error=no_student");

  return <PortalHome data={data} />;
}
