import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getPortalDashboard, getGymProducts } from "../actions";
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
      />
    );
  }

  const data = await getPortalDashboard(identity.studentId);
  const products = data ? await getGymProducts(data.student.gym_id) : [];

  return (
    <ShopClient
      studentId={identity.studentId}
      credits={data?.credits ?? EMPTY_CREDITS}
      purchases={data?.purchases ?? []}
      memberships={data?.memberships ?? []}
      products={products}
    />
  );
}
