import { redirect, notFound } from "next/navigation";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getStudentConversationDetail } from "@/app/(dashboard)/messages/actions";
import { PortalThread } from "@/components/portal/portal-thread";

export const dynamic = "force-dynamic";

export default async function PortalConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const identity = await getCurrentStudentIdentity();
  if (!identity) redirect("/login");

  const detail = await getStudentConversationDetail(id, identity.studentId);
  if (!detail) notFound();

  return <PortalThread detail={detail} studentId={identity.studentId} />;
}
