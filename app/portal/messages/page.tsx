import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { listStudentConversations } from "@/app/(dashboard)/messages/actions";
import { PortalMessages } from "@/components/portal/portal-messages";

export const dynamic = "force-dynamic";

export default async function PortalMessagesPage() {
  const identity = await getCurrentStudentIdentity();
  const conversations = identity
    ? await listStudentConversations(identity.studentId)
    : [];

  return <PortalMessages conversations={conversations} />;
}
