import { redirect } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { listConversations, listStudentsForGym } from "./actions";
import { MessagesInbox } from "@/components/messages/messages-inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Messages · MatFlow" };

export default async function MessagesPage() {
  const role = await getCurrentRole();
  if (!can(role, "view_messages")) redirect("/dashboard");

  const gymId = await getCurrentGymId();
  if (!gymId) redirect("/onboarding");

  const [conversations, students] = await Promise.all([
    listConversations(gymId),
    listStudentsForGym(gymId),
  ]);

  return (
    <MessagesInbox
      gymId={gymId}
      conversations={conversations}
      students={students}
    />
  );
}
