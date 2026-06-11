import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { getOnboardingState } from "@/app/onboarding/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome · MatFlow" };

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

export default async function OnboardingPage() {
  const state = await getOnboardingState();

  if (!state) {
    return (
      <div className="min-h-screen grid place-items-center px-4">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Workspace not found
          </h1>
          <p className="text-sm text-[#aaa]">
            Couldn&apos;t locate the academy workspace. Make sure a row exists
            in <code>gyms</code> with{" "}
            <code className="font-mono">slug = &quot;asbury-park&quot;</code>{" "}
            (or set <code>ASBURY_PARK_GYM_ID</code>).
          </p>
        </div>
      </div>
    );
  }

  return <OnboardingWizard initial={state} timezones={COMMON_TIMEZONES} />;
}
