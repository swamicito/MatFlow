"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, Loader2, Sparkles, RefreshCw, Users, ChevronDown, ChevronUp, Check } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { sendOwnerMessage } from "@/app/(dashboard)/messages/actions";
import { MESSAGE_TEMPLATES } from "@/lib/message-templates";
import type { ConversationDetail } from "@/app/(dashboard)/messages/actions";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function participantLabel(p: { id: string; full_name: string }[]): string {
  if (p.length === 0) return "Conversation";
  if (p.length === 1) return p[0].full_name;
  if (p.length === 2) return `${p[0].full_name} & ${p[1].full_name}`;
  return `${p[0].full_name} +${p.length - 1} others`;
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

// ─────────────────────────────────────────────────────────────────────────────
// Thread
// ─────────────────────────────────────────────────────────────────────────────

export function ConversationThread({
  detail,
  gymId,
}: {
  detail: ConversationDetail;
  gymId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [content, setContent] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [detail.messages.length]);

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 10000);
    return () => clearInterval(interval);
  }, [router]);

  function handleSend() {
    if (!content.trim()) return;
    startTransition(async () => {
      const result = await sendOwnerMessage(detail.id, gymId, content);
      if (!result.ok) { toast.error(result.error); return; }
      setContent("");
      router.refresh();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 150);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
  }

  const title = detail.subject || participantLabel(detail.participants);
  const isGroup = detail.participants.length > 1;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-[#141414] pb-3 space-y-2">
        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            className="h-8 w-8 grid place-items-center rounded-full text-[#555] hover:text-white hover:bg-[#111] transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Avatar */}
          <div className={cn(
            "h-9 w-9 rounded-full grid place-items-center shrink-0 text-sm font-bold border",
            "bg-[#1a1a1a] border-[#2a2a2a] text-white",
          )}>
            {isGroup
              ? <Users className="h-4 w-4 text-[#666]" />
              : <span>{detail.participants[0]?.full_name[0]?.toUpperCase() ?? "?"}</span>}
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white truncate leading-tight">{title}</h1>
            <button
              onClick={() => setShowParticipants(!showParticipants)}
              className="inline-flex items-center gap-1 text-xs text-[#555] hover:text-[#aaa] transition-colors mt-0.5"
            >
              <Users className="h-3 w-3" />
              {detail.participants.length} participant{detail.participants.length !== 1 ? "s" : ""}
              {showParticipants ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>

          <button
            onClick={() => router.refresh()}
            className="h-8 w-8 grid place-items-center rounded-full text-[#333] hover:text-white hover:bg-[#111] transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Collapsible participants */}
        {showParticipants && detail.participants.length > 0 && (
          <div className="ml-11 flex flex-wrap gap-1.5 pb-1">
            {detail.participants.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 text-xs bg-[#111] border border-[#1f1f1f] text-[#aaa] rounded-full px-2.5 py-1"
              >
                <span className="h-4 w-4 rounded-full bg-[#2a2a2a] grid place-items-center text-[10px] font-bold text-white">
                  {p.full_name[0].toUpperCase()}
                </span>
                {p.full_name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto py-4 min-h-0 space-y-1">
        {detail.messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[#111] border border-[#1f1f1f] grid place-items-center">
              <Send className="h-5 w-5 text-[#333]" />
            </div>
            <p className="text-sm text-[#555]">Send your first message</p>
          </div>
        ) : (
          <>
            {detail.messages.map((m, i) => {
              const isOwner = m.sender_type === "owner";
              const showDate = shouldShowDate(detail.messages, i);
              const prevMsg = i > 0 ? detail.messages[i - 1] : null;
              const isFirstInGroup = !prevMsg || prevMsg.sender_type !== m.sender_type ||
                (new Date(m.created_at).getTime() - new Date(prevMsg.created_at).getTime()) > 5 * 60 * 1000;
              const nextMsg = detail.messages[i + 1] ?? null;
              const isLastInGroup = !nextMsg || nextMsg.sender_type !== m.sender_type ||
                (new Date(nextMsg.created_at).getTime() - new Date(m.created_at).getTime()) > 5 * 60 * 1000;

              return (
                <div key={m.id}>
                  {/* Date divider */}
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
                    isOwner ? "flex-row-reverse" : "flex-row",
                    isLastInGroup ? "mb-3" : "mb-0.5",
                  )}>
                    {/* Student avatar — only on last in group */}
                    {!isOwner && (
                      <div className={cn(
                        "h-7 w-7 rounded-full bg-[#1f1f1f] border border-[#2a2a2a] grid place-items-center shrink-0 text-xs font-bold text-white transition-opacity",
                        isLastInGroup ? "opacity-100" : "opacity-0",
                      )}>
                        {m.sender_name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}

                    <div className={cn(
                      "flex flex-col gap-0.5 max-w-[72%]",
                      isOwner ? "items-end" : "items-start",
                    )}>
                      {/* Sender name — first in group, student only */}
                      {!isOwner && isFirstInGroup && (
                        <span className="text-[11px] text-[#555] font-medium ml-1">
                          {m.sender_name}
                        </span>
                      )}

                      {/* Bubble */}
                      <div className={cn(
                        "px-4 py-2.5 text-sm leading-relaxed break-words",
                        isOwner
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

                      {/* Timestamp + read receipt — last in group only */}
                      {isLastInGroup && (
                        <div className={cn(
                          "flex items-center gap-1 text-[10px] text-[#3a3a3a] mx-1",
                          isOwner ? "flex-row-reverse" : "flex-row",
                        )}>
                          <span>{formatTime(m.created_at)}</span>
                          {isOwner && m.read_at && (
                            <span className="inline-flex items-center gap-0.5 text-[#555]">
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
      <div className="shrink-0 border-t border-[#141414] pt-3 space-y-2">
        {showTemplates && (
          <div className="rounded-xl border border-[#1a1a1a] divide-y divide-[#111] overflow-hidden max-h-44 overflow-y-auto">
            {MESSAGE_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => { setContent(t.content); setShowTemplates(false); textareaRef.current?.focus(); }}
                className="w-full text-left px-3.5 py-2.5 bg-[#080808] hover:bg-[#0f0f0f] transition-colors"
              >
                <p className="text-xs font-semibold text-white">{t.label}</p>
                <p className="text-xs text-[#444] mt-0.5 line-clamp-1">{t.content}</p>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates(!showTemplates)}
            className={cn(
              "h-10 w-10 grid place-items-center rounded-xl border shrink-0 transition-colors",
              showTemplates
                ? "border-white/20 bg-white/10 text-white"
                : "border-[#1f1f1f] bg-[#0a0a0a] text-[#444] hover:text-white hover:border-[#2a2a2a]",
            )}
            title="Templates"
          >
            <Sparkles className="h-4 w-4" />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              rows={1}
              style={{ minHeight: "40px", maxHeight: "120px" }}
              className="w-full px-4 py-2.5 rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] text-sm text-white placeholder:text-[#333] focus:outline-none focus:border-[#2a2a2a] resize-none transition-colors leading-relaxed overflow-y-auto"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={pending || !content.trim()}
            className="h-10 w-10 grid place-items-center rounded-xl bg-white text-black hover:bg-white/90 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[10px] text-[#2a2a2a] text-right pb-1">⌘↵ to send</p>
      </div>
    </div>
  );
}
