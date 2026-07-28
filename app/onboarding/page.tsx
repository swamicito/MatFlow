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
            Account not ready yet
          </h1>
          <p className="text-sm text-[#aaa]">
            Your gym workspace is still being set up. You&apos;ll receive an
            email with your login link once it&apos;s ready — usually within a
            few hours. If you have questions, reply to that email or contact{" "}
            <a
              href="mailto:support@mat-flow.net"
              className="text-emerald-400 hover:underline"
            >
              support@mat-flow.net
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return <OnboardingWizard initial={state} timezones={COMMON_TIMEZONES} />;
}
