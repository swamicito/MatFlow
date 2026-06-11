"use client";

import { useRouter } from "next/navigation";
import { MessageSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/app/(dashboard)/messages/actions";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PortalMessages({
  conversations,
}: {
  conversations: ConversationSummary[];
}) {
  const router = useRouter();
  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
          Messages
          {totalUnread > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] bg-white text-black text-[11px] font-bold rounded-full px-1.5">
              {totalUnread}
            </span>
          )}
        </h1>
        <p className="text-sm text-[#555] mt-0.5">
          {conversations.length === 0 ? "No messages yet" : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-[#1a1a1a] bg-[#080808] py-20 flex flex-col items-center gap-4">
          <div className="h-16 w-16 grid place-items-center rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f]">
            <MessageSquare className="h-7 w-7 text-[#333]" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-white">No messages yet</p>
            <p className="text-xs text-[#555]">Your gym will reach out to you here.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1a1a1a] overflow-hidden divide-y divide-[#0f0f0f]">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/portal/messages/${c.id}`)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-[#080808] hover:bg-[#0f0f0f] active:bg-[#111] transition-colors text-left group"
            >
              {/* Gym avatar */}
              <div className={cn(
                "h-11 w-11 rounded-full grid place-items-center shrink-0 font-black border transition-all",
                c.unread_count > 0 ? "bg-white text-black border-white/20" : "bg-[#1a1a1a] border-[#222]",
              )}>
                <span className={cn("text-sm", c.unread_count > 0 ? "text-black" : "text-[#888]")}>G</span>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={cn(
                    "text-sm truncate",
                    c.unread_count > 0 ? "font-semibold text-white" : "font-medium text-[#bbb]",
                  )}>
                    {c.subject ?? "Gym message"}
                  </p>
                  <span className={cn(
                    "text-[11px] shrink-0 tabular-nums",
                    c.unread_count > 0 ? "text-white font-medium" : "text-[#444]",
                  )}>
                    {timeAgo(c.updated_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className={cn(
                    "text-xs truncate",
                    c.unread_count > 0 ? "text-[#aaa]" : "text-[#444]",
                  )}>
                    {c.last_message_sender === "student"
                      ? <span className="text-[#666]">You: </span>
                      : null}
                    {c.last_message ?? "No messages yet"}
                  </p>
                  {c.unread_count > 0 && (
                    <span className="shrink-0 inline-flex items-center justify-center h-5 min-w-[20px] bg-white text-black text-[10px] font-bold rounded-full px-1.5">
                      {c.unread_count}
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-[#2a2a2a] group-hover:text-[#444] shrink-0 transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
