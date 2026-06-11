"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendStudentMessage } from "@/app/(dashboard)/messages/actions";
import type { ConversationDetail } from "@/app/(dashboard)/messages/actions";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function shouldShowDate(messages: ConversationDetail["messages"], index: number): boolean {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_at);
  const curr = new Date(messages[index].created_at);
  return prev.toDateString() !== curr.toDateString();
}

function formatDateDivider(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function PortalThread({
  detail,
  studentId,
}: {
  detail: ConversationDetail;
  studentId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail.messages.length]);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(interval);
  }, [router]);

  function handleSend() {
    if (!content.trim()) return;
    startTransition(async () => {
      const result = await sendStudentMessage(detail.id, studentId, content);
      if (!result.ok) { toast.error(result.error); return; }
      setContent("");
      router.refresh();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 7rem)" }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 pb-3 border-b border-[#141414] shrink-0">
        <Link
          href="/portal/messages"
          className="h-8 w-8 grid place-items-center rounded-full text-[#555] hover:text-white hover:bg-[#111] transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* Gym avatar */}
        <div className="h-9 w-9 rounded-full bg-white grid place-items-center shrink-0">
          <span className="text-sm font-black text-black">G</span>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-white truncate leading-tight">
            {detail.subject ?? "Gym"}
          </h1>
          <p className="text-[11px] text-[#555]">Your Gym</p>
        </div>

        <button
          onClick={() => router.refresh()}
          className="h-8 w-8 grid place-items-center rounded-full text-[#333] hover:text-white hover:bg-[#111] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto py-4 min-h-0 space-y-1">
        {detail.messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-[#555]">No messages yet.</p>
          </div>
        ) : (
          <>
            {detail.messages.map((m, i) => {
              const isMe = m.sender_type === "student";
              const showDate = shouldShowDate(detail.messages, i);
              const prevMsg = i > 0 ? detail.messages[i - 1] : null;
              const isFirstInGroup = !prevMsg || prevMsg.sender_type !== m.sender_type ||
                (new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime()) > 5 * 60 * 1000;
              const nextMsg = detail.messages[i + 1] ?? null;
              const isLastInGroup = !nextMsg || nextMsg.sender_type !== m.sender_type ||
                (new Date(nextMsg.created_at).getTime() - new Date(m.created_at).getTime()) > 5 * 60 * 1000;

              return (
                <div key={m.id}>
                  {showDate && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-[#111]" />
                      <span className="text-[11px] text-[#444] font-medium shrink-0">
                        {formatDateDivider(m.created_at)}
                      </span>
                      <div className="flex-1 h-px bg-[#111]" />
                    </div>
                  )}

                  <div className={cn(
                    "flex items-end gap-2 px-1",
                    isMe ? "flex-row-reverse" : "flex-row",
                    isLastInGroup ? "mb-3" : "mb-0.5",
                  )}>
                    {/* Gym avatar — only on last gym message */}
                    {!isMe && (
                      <div className={cn(
                        "h-7 w-7 rounded-full bg-white grid place-items-center shrink-0 transition-opacity",
                        isLastInGroup ? "opacity-100" : "opacity-0",
                      )}>
                        <span className="text-[10px] font-black text-black">G</span>
                      </div>
                    )}

                    <div className={cn(
                      "flex flex-col gap-0.5 max-w-[75%]",
                      isMe ? "items-end" : "items-start",
                    )}>
                      <div className={cn(
                        "px-4 py-2.5 text-sm leading-relaxed break-words",
                        isMe
                          ? cn(
                              "bg-white text-black",
                              isFirstInGroup ? "rounded-t-2xl" : "rounded-t-lg",
                              isLastInGroup ? "rounded-bl-2xl rounded-br-sm" : "rounded-b-lg",
                            )
                          : cn(
                              "bg-[#1a1a1a] text-white border border-[#242424]",
                              isFirstInGroup ? "rounded-t-2xl" : "rounded-t-lg",
                              isLastInGroup ? "rounded-br-2xl rounded-bl-sm" : "rounded-b-lg",
                            ),
                      )}>
                        {m.content}
                      </div>

                      {isLastInGroup && (
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] text-[#3a3a3a] mx-1",
                          isMe ? "flex-row-reverse" : "flex-row",
                        )}>
                          <span>{formatTime(m.created_at)}</span>
                          {isMe && m.read_at && (
                            <span className="inline-flex items-center text-[#555]">
                              <Check className="h-2.5 w-2.5" />
                              <Check className="h-2.5 w-2.5 -ml-1.5" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Compose ── */}
      <div className="border-t border-[#141414] pt-3 pb-2 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            style={{ minHeight: "40px", maxHeight: "120px" }}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#2a2a2a] resize-none transition-colors leading-relaxed overflow-y-auto"
          />
          <button
            onClick={handleSend}
            disabled={pending || !content.trim()}
            className="h-10 w-10 grid place-items-center rounded-xl bg-white text-black hover:bg-white/90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
