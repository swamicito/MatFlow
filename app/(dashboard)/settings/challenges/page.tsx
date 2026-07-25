import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listChallengesForAdmin } from "@/app/(dashboard)/students/gamification-actions";
import { listPassportChallenges } from "@/app/(dashboard)/settings/challenges/actions";
import { ChallengesAdmin } from "@/components/challenges/challenges-admin";
import { PassportChallengesAdmin } from "@/components/challenges/passport-challenges-admin";

export const dynamic = "force-dynamic";

export default async function ChallengesSettingsPage() {
  const [res, passportRes] = await Promise.all([
    listChallengesForAdmin(),
    listPassportChallenges(),
  ]);

  return (
    <div className="space-y-6">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-sm text-[#555] hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          Challenges & Gamification
        </h1>
        <p className="text-sm text-[#aaa] mt-1">
          Time-limited training challenges. Students opt in from their profile;
          progress is computed automatically from attendance.
        </p>
      </header>

      {!res.ok ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {res.error.includes("challenges") || res.error.includes("relation") ? (
            <>
              Gamification tables are missing. Apply{" "}
              <code className="text-white">
                supabase/migrations/0007_gamification.sql
              </code>{" "}
              and reload.
            </>
          ) : (
            res.error
          )}
        </div>
      ) : (
        <ChallengesAdmin initial={res.data} />
      )}

      {/* ── Passport Challenges ────────────────────────────────────────────── */}
      <div className="pt-4 border-t border-[#1a1a1a] space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Passport Challenges</h2>
          <p className="text-sm text-[#aaa] mt-0.5">
            Point-based goals that integrate with the student Passport. Progress
            is tracked automatically — students see live progress bars in their
            portal.
          </p>
        </div>

        {!passportRes.ok ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {passportRes.error.includes("passport_challenges") ||
            passportRes.error.includes("relation") ? (
              <>
                Passport challenge tables are missing. Apply{" "}
                <code className="text-white">
                  supabase/migrations/0021_challenges.sql
                </code>{" "}
                and reload.
              </>
            ) : (
              passportRes.error
            )}
          </div>
        ) : (
          <PassportChallengesAdmin initial={passportRes.data} />
        )}
      </div>
    </div>
  );
}
