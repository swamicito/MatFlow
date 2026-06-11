import { redirect } from "next/navigation";
import { getCurrentStudentIdentity } from "@/lib/auth/current-student";
import { getPortalDashboard } from "../actions";
import { Play, CheckCircle2, Clock } from "lucide-react";
import { formatDuration } from "@/lib/portal-utils";

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const identity = await getCurrentStudentIdentity();
  if (!identity) redirect("/login");

  const data = await getPortalDashboard(identity.studentId);
  if (!data) redirect("/login?error=no_student");

  const { instructionals } = data;

  const inProgress = instructionals.filter((v) => v.position_seconds > 0 && !v.completed);
  const completed = instructionals.filter((v) => v.completed);
  const notStarted = instructionals.filter((v) => v.position_seconds === 0 && !v.completed);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My Videos</h1>

      {instructionals.length === 0 ? (
        <div className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] py-16 flex flex-col items-center gap-4">
          <div className="h-16 w-16 grid place-items-center rounded-2xl border border-[#222] bg-black">
            <Play className="h-7 w-7 text-[#444]" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-white">No videos yet</p>
            <p className="text-xs text-[#555]">Purchase instructionals from your gym to watch them here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {inProgress.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[#aaa]">Continue Watching</h2>
              <VideoGrid videos={inProgress} />
            </section>
          )}
          {notStarted.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[#aaa]">Not Started</h2>
              <VideoGrid videos={notStarted} />
            </section>
          )}
          {completed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium text-[#aaa]">Completed</h2>
              <VideoGrid videos={completed} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function VideoGrid({ videos }: { videos: ReturnType<typeof Array.prototype.filter> }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {(videos as { id: string; title: string; description: string | null; category: string; duration_seconds: number | null; thumbnail_url: string | null; completed_pct: number; completed: boolean; position_seconds: number }[]).map((v) => (
        <div
          key={v.id}
          className="rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] overflow-hidden flex gap-3 p-3 items-center"
        >
          {/* Thumbnail */}
          <div className="relative h-16 w-28 rounded-lg overflow-hidden bg-[#111] shrink-0 flex items-center justify-center">
            {v.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.thumbnail_url} alt={v.title} className="object-cover w-full h-full" />
            ) : (
              <Play className="h-6 w-6 text-[#333]" />
            )}
            {v.completed && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-sm font-medium text-white truncate">{v.title}</p>
            <div className="flex items-center gap-2 text-[10px] text-[#555]">
              <span className="border border-[#222] rounded px-1.5 py-0.5">{v.category}</span>
              {v.duration_seconds && (
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {formatDuration(v.duration_seconds)}
                </span>
              )}
            </div>
            {v.position_seconds > 0 && !v.completed && (
              <div className="h-1 w-full rounded-full bg-[#1f1f1f] overflow-hidden">
                <div
                  className="h-full rounded-full bg-white"
                  style={{ width: `${v.completed_pct}%` }}
                />
              </div>
            )}
          </div>

          {/* Status */}
          <div className="shrink-0">
            {v.completed ? (
              <span className="text-[10px] text-emerald-400">Done</span>
            ) : (
              <div className="h-8 w-8 grid place-items-center rounded-full bg-white hover:bg-white/90 transition-colors cursor-pointer">
                <Play className="h-3.5 w-3.5 text-black fill-black" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
