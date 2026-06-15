import { redirect, notFound } from "next/navigation";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { getConversationDetail } from "../actions";
import { ConversationThread } from "@/components/messages/conversation-thread";

export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const role = await getCurrentRole();
  if (!can(role, "view_messages")) redirect("/dashboard");

  const [gymId, isPA] = await Promise.all([
    getCurrentGymId(),
    isPlatformAdmin(),
  ]);
  if (!gymId) redirect("/onboarding");

  const detail = await getConversationDetail(id, gymId);
  if (!detail) notFound();

  const canDelete = can(role, "delete_thread") || isPA;

  return <ConversationThread detail={detail} gymId={gymId} canDelete={canDelete} />;
}
