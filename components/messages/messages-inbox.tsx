"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Search,
  X,
  ChevronRight,
  Loader2,
  Check,
  CheckCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createConversation } from "@/app/(dashboard)/messages/actions";
import { MESSAGE_TEMPLATES } from "@/lib/message-templates";
import type { ConversationSummary, StudentOption } from "@/app/(dashboard)/messages/actions";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function participantLabel(p: ConversationSummary["participants"]): string {
  if (p.length === 0) return "Unknown";
  if (p.length === 1) return p[0].full_name;
  if (p.length === 2) return `${p[0].full_name} & ${p[1].full_name}`;
  return `${p[0].full_name} +${p.length - 1} others`;
}

function avatarInitials(p: ConversationSummary["participants"]): string {
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].full_name[0].toUpperCase();
  return p[0].full_name[0].toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main inbox
// ─────────────────────────────────────────────────────────────────────────────

export function MessagesInbox({
  gymId,
  conversations,
  students,
}: {
  gymId: string;
  conversations: ConversationSummary[];
  students: StudentOption[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            Messages
            {totalUnread > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] bg-white text-black text-[11px] font-bold rounded-full px-1.5">
                {totalUnread}
              </span>
            )}
          </h1>
          <p className="text-sm text-[#666] mt-0.5">
            {conversations.length === 0
              ? "No conversations yet"
              : `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" />
          New
        </button>
      </div>

      {/* Conversation list */}
      {conversations.length === 0 ? (
        <div className="rounded-2xl border border-[#1a1a1a] bg-[#080808] py-20 flex flex-col items-center gap-4">
          <div className="h-16 w-16 grid place-items-center rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f]">
            <MessageSquare className="h-7 w-7 text-[#333]" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-white">No conversations yet</p>
            <p className="text-xs text-[#555] max-w-xs">
              Start a conversation to message your students directly.
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-all"
          >
            <Plus className="h-4 w-4" />
            Start a conversation
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1a1a1a] overflow-hidden divide-y divide-[#0f0f0f]">
          {conversations.map((c) => {
            const isGroup = c.participants.length > 1;
            return (
              <button
                key={c.id}
                onClick={() => router.push(`/messages/${c.id}`)}
                className="w-full flex items-center gap-3.5 px-4 py-3.5 bg-[#080808] hover:bg-[#0f0f0f] active:bg-[#111] transition-colors text-left group"
              >
                {/* Avatar */}
                <div className={cn(
                  "h-11 w-11 rounded-full grid place-items-center shrink-0 text-sm font-bold border",
                  c.unread_count > 0
                    ? "bg-white text-black border-white/20"
                    : "bg-[#1a1a1a] text-[#888] border-[#222]",
                )}>
                  {isGroup
                    ? <Users className="h-4.5 w-4.5" />
                    : avatarInitials(c.participants)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn(
                      "text-sm truncate",
                      c.unread_count > 0 ? "font-semibold text-white" : "font-medium text-[#bbb]",
                    )}>
                      {c.subject || participantLabel(c.participants)}
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
                      {c.last_message_sender === "owner"
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
                  {c.subject && c.participants.length > 0 && (
                    <p className="text-[11px] text-[#444] truncate mt-0.5">
                      {participantLabel(c.participants)}
                    </p>
                  )}
                </div>

                <ChevronRight className="h-4 w-4 text-[#2a2a2a] group-hover:text-[#444] shrink-0 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {/* New conversation dialog */}
      {showNew && (
        <NewConversationDialog
          gymId={gymId}
          students={students}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// New Conversation Dialog
// ─────────────────────────────────────────────────────────────────────────────

function NewConversationDialog({
  gymId,
  students,
  onClose,
}: {
  gymId: string;
  students: StudentOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<StudentOption[]>([]);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
    );
  }, [search, students]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((s) => selected.some((p) => p.id === s.id));

  function toggle(s: StudentOption) {
    setSelected((prev) =>
      prev.find((p) => p.id === s.id) ? prev.filter((p) => p.id !== s.id) : [...prev, s],
    );
  }

  function toggleAll() {
    if (allFilteredSelected) {
      const filteredIds = new Set(filtered.map((s) => s.id));
      setSelected((prev) => prev.filter((p) => !filteredIds.has(p.id)));
    } else {
      const existing = new Set(selected.map((s) => s.id));
      const toAdd = filtered.filter((s) => !existing.has(s.id));
      setSelected((prev) => [...prev, ...toAdd]);
    }
  }

  function handleSend() {
    startTransition(async () => {
      const result = await createConversation(
        gymId,
        selected.map((s) => s.id),
        subject,
        content,
      );
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Conversation started");
      router.push(`/messages/${result.id}`);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[#0a0a0a] border border-[#1f1f1f] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[#141414] shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">New Conversation</h2>
            <p className="text-xs text-[#555] mt-0.5">
              {selected.length === 0
                ? "Select students to message"
                : `${selected.length} student${selected.length !== 1 ? "s" : ""} selected`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-full text-[#555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Student multi-select */}
          <div className="px-5 pt-4 pb-2 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-[#666] font-medium uppercase tracking-wider">To</label>
              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors",
                    allFilteredSelected
                      ? "bg-white/10 text-white hover:bg-white/15"
                      : "bg-[#1a1a1a] text-[#888] hover:text-white hover:bg-[#222]",
                  )}
                >
                  {allFilteredSelected ? (
                    <><CheckCheck className="h-3 w-3" /> Deselect all</>
                  ) : (
                    <><Check className="h-3 w-3" /> Select all ({filtered.length})</>
                  )}
                </button>
              )}
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selected.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-center gap-1 text-xs bg-white text-black rounded-full pl-2.5 pr-1.5 py-1 font-medium"
                  >
                    {s.full_name}
                    <button
                      onClick={() => toggle(s)}
                      className="h-4 w-4 grid place-items-center rounded-full hover:bg-black/10 transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#444]" />
              <input
                type="text"
                placeholder="Search students…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-8.5 pr-3 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#333] transition-colors"
              />
            </div>

            {/* Student list */}
            <div className="rounded-xl border border-[#141414] overflow-hidden max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-[#444] text-center py-8">No students found</p>
              ) : (
                filtered.map((s) => {
                  const isSelected = selected.some((p) => p.id === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
                        isSelected ? "bg-[#111]" : "bg-[#080808] hover:bg-[#0f0f0f]",
                      )}
                    >
                      <div className={cn(
                        "h-5 w-5 rounded-md border-2 shrink-0 grid place-items-center transition-all",
                        isSelected ? "bg-white border-white scale-105" : "border-[#2a2a2a]",
                      )}>
                        {isSelected && <Check className="h-3 w-3 text-black stroke-[3]" />}
                      </div>
                      <div className="h-7 w-7 rounded-full bg-[#1f1f1f] grid place-items-center shrink-0">
                        <span className="text-xs font-semibold text-white">
                          {s.full_name[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{s.full_name}</p>
                        <p className="text-xs text-[#444] truncate">{s.email}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Subject + Message */}
          <div className="px-5 pt-2 pb-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-[#666] font-medium uppercase tracking-wider">
                Subject <span className="normal-case tracking-normal font-normal text-[#444]">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Belt promotion, Class reminder…"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-10 px-3.5 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#333] transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[#666] font-medium uppercase tracking-wider">Message</label>
                <button
                  type="button"
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors",
                    showTemplates ? "bg-white/10 text-white" : "text-[#555] hover:text-white",
                  )}
                >
                  <Sparkles className="h-3 w-3" />
                  Templates
                </button>
              </div>

              {showTemplates && (
                <div className="rounded-xl border border-[#1a1a1a] divide-y divide-[#111] overflow-hidden mb-2">
                  {MESSAGE_TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => { setContent(t.content); setShowTemplates(false); }}
                      className="w-full text-left px-3.5 py-2.5 bg-[#0a0a0a] hover:bg-[#111] transition-colors"
                    >
                      <p className="text-xs font-semibold text-white">{t.label}</p>
                      <p className="text-xs text-[#555] mt-0.5 line-clamp-1">{t.content}</p>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                placeholder="Write your message…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                className="w-full px-3.5 py-3 rounded-xl border border-[#1f1f1f] bg-[#111] text-sm text-white placeholder:text-[#444] focus:outline-none focus:border-[#333] resize-none transition-colors leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#141414] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1.5">
                  {selected.slice(0, 3).map((s) => (
                    <div key={s.id} className="h-6 w-6 rounded-full bg-[#1f1f1f] border-2 border-[#0a0a0a] grid place-items-center">
                      <span className="text-[10px] font-bold text-white">{s.full_name[0]}</span>
                    </div>
                  ))}
                </div>
                <span className="text-xs text-[#555]">
                  {selected.length} selected
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-xl border border-[#1f1f1f] text-sm text-[#777] hover:text-white hover:border-[#2a2a2a] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={pending || selected.length === 0 || !content.trim()}
              className="h-9 px-5 rounded-xl bg-white text-black text-sm font-bold hover:bg-white/90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
