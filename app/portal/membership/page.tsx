import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getPortalDashboard } from "../actions";
import { MembershipClient } from "@/components/portal/membership-client";

export const dynamic = "force-dynamic";

const EMPTY_CREDITS = { class_credits: 0, gift_card_balance_cents: 0 };

export default async function MembershipPage() {
  const identity = await getCurrentStudentIdentity();

  if (!identity) {
    return (
      <MembershipClient
        studentId=""
        memberships={[]}
        credits={EMPTY_CREDITS}
      />
    );
  }

  const data = await getPortalDashboard(identity.studentId);

  return (
    <MembershipClient
      studentId={identity.studentId}
      memberships={data?.memberships ?? []}
      credits={data?.credits ?? EMPTY_CREDITS}
    />
  );
}
