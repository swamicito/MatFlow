import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getPortalDashboard, getGymProducts, getGymPaymentsReady } from "../actions";
import { ShopClient } from "@/components/portal/shop-client";

export const dynamic = "force-dynamic";

const EMPTY_CREDITS = { class_credits: 0, gift_card_balance_cents: 0 };

export default async function ShopPage() {
  const identity = await getCurrentStudentIdentity();

  if (!identity) {
    return (
      <ShopClient
        studentId=""
        credits={EMPTY_CREDITS}
        purchases={[]}
        memberships={[]}
        products={[]}
        paymentsReady={false}
      />
    );
  }

  const data = await getPortalDashboard(identity.studentId);
  const gymId = data?.student.gym_id;
  const [products, paymentsReady] = gymId
    ? await Promise.all([getGymProducts(gymId), getGymPaymentsReady(gymId)])
    : [[], false];

  return (
    <ShopClient
      studentId={identity.studentId}
      credits={data?.credits ?? EMPTY_CREDITS}
      purchases={data?.purchases ?? []}
      memberships={data?.memberships ?? []}
      products={products}
      paymentsReady={paymentsReady}
    />
  );
}
