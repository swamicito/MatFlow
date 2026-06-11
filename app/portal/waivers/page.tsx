import { redirect } from "next/navigation";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getPortalWaivers } from "../actions";
import { PortalWaivers } from "@/components/portal/portal-waivers";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waivers · MatFlow Portal" };

export default async function PortalWaiversPage() {
  const identity = await getCurrentStudentIdentity();
  if (!identity) redirect("/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any;
  const { data: student } = await admin
    .from("students")
    .select("full_name")
    .eq("id", identity.studentId)
    .maybeSingle();

  const { templates, signedWaivers } = await getPortalWaivers(identity.studentId);

  return (
    <PortalWaivers
      templates={templates}
      signedWaivers={signedWaivers}
      studentName={(student?.full_name as string | null) ?? ""}
    />
  );
}
