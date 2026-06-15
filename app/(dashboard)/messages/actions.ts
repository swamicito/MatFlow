"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePermission } from "@/lib/auth/current-role";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Participant = { id: string; full_name: string };

export type ConversationSummary = {
  id: string;
  subject: string | null;
  created_at: string;
  updated_at: string;
  participants: Participant[];
  last_message: string | null;
  last_message_sender: "owner" | "student" | null;
  unread_count: number; // messages from students that owner hasn't read
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_type: "owner" | "student";
  sender_id: string;
  sender_name: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

export type ConversationDetail = {
  id: string;
  subject: string | null;
  gym_id: string;
  participants: Participant[];
  messages: MessageRow[];
};

export type StudentOption = { id: string; full_name: string; email: string };

// ─────────────────────────────────────────────────────────────────────────────
// Owner – list conversations
// ─────────────────────────────────────────────────────────────────────────────

export async function listConversations(gymId: string): Promise<ConversationSummary[]> {
  const admin = createAdminClient() as any;

  const { data: convs } = await admin
    .from("conversations")
    .select("id, subject, created_at, updated_at")
    .eq("gym_id", gymId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (!convs || convs.length === 0) return [];

  const convIds: string[] = convs.map((c: any) => c.id);

  const [{ data: partRows }, { data: allMessages }] = await Promise.all([
    admin
      .from("conversation_participants")
      .select("conversation_id, student_id, students(id, full_name)")
      .in("conversation_id", convIds),
    admin
      .from("messages")
      .select("id, conversation_id, sender_type, content, read_at, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false }),
  ]);

  const participantsByConv: Record<string, Participant[]> = {};
  for (const p of partRows ?? []) {
    if (!participantsByConv[p.conversation_id]) participantsByConv[p.conversation_id] = [];
    if (p.students) participantsByConv[p.conversation_id].push(p.students);
  }

  const messagesByConv: Record<string, any[]> = {};
  for (const m of allMessages ?? []) {
    if (!messagesByConv[m.conversation_id]) messagesByConv[m.conversation_id] = [];
    messagesByConv[m.conversation_id].push(m);
  }

  return convs.map((c: any) => {
    const msgs = messagesByConv[c.id] ?? [];
    const lastMsg = msgs[0];
    const unread = msgs.filter((m: any) => m.sender_type === "student" && !m.read_at).length;
    return {
      id: c.id,
      subject: c.subject ?? null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      participants: participantsByConv[c.id] ?? [],
      last_message: lastMsg?.content ?? null,
      last_message_sender: lastMsg?.sender_type ?? null,
      unread_count: unread,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner – get conversation detail + mark student messages as read
// ─────────────────────────────────────────────────────────────────────────────

export async function getConversationDetail(
  conversationId: string,
  gymId: string,
): Promise<ConversationDetail | null> {
  const admin = createAdminClient() as any;

  const { data: conv } = await admin
    .from("conversations")
    .select("id, subject, gym_id")
    .eq("id", conversationId)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!conv) return null;

  const [{ data: partRows }, { data: msgs }] = await Promise.all([
    admin
      .from("conversation_participants")
      .select("student_id, students(id, full_name)")
      .eq("conversation_id", conversationId),
    admin
      .from("messages")
      .select("id, conversation_id, sender_type, sender_id, content, read_at, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);

  const participants: Participant[] = (partRows ?? [])
    .filter((p: any) => p.students)
    .map((p: any) => p.students);

  const participantMap: Record<string, string> = {};
  for (const p of participants) participantMap[p.id] = p.full_name;

  // Mark unread student messages as read
  const unreadIds = (msgs ?? [])
    .filter((m: any) => m.sender_type === "student" && !m.read_at)
    .map((m: any) => m.id);
  if (unreadIds.length > 0) {
    await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  const messages: MessageRow[] = (msgs ?? []).map((m: any) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_type: m.sender_type as "owner" | "student",
    sender_id: m.sender_id,
    sender_name: m.sender_type === "owner" ? "Gym" : (participantMap[m.sender_id] ?? "Student"),
    content: m.content,
    read_at: m.read_at,
    created_at: m.created_at,
  }));

  return { id: conv.id, subject: conv.subject, gym_id: conv.gym_id, participants, messages };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner – create a new conversation
// ─────────────────────────────────────────────────────────────────────────────

export async function createConversation(
  gymId: string,
  studentIds: string[],
  subject: string,
  firstMessage: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!studentIds.length) return { ok: false, error: "Select at least one student." };
  if (!firstMessage.trim()) return { ok: false, error: "Message cannot be empty." };

  const admin = createAdminClient() as any;

  const { data: conv, error: convErr } = await admin
    .from("conversations")
    .insert({ gym_id: gymId, subject: subject.trim() || null })
    .select("id")
    .single();

  if (convErr || !conv) return { ok: false, error: convErr?.message ?? "Failed to create conversation." };

  const convId = conv.id;

  await admin.from("conversation_participants").insert(
    studentIds.map((sid) => ({ conversation_id: convId, student_id: sid })),
  );

  const { error: msgErr } = await admin.from("messages").insert({
    conversation_id: convId,
    sender_type: "owner",
    sender_id: gymId,
    content: firstMessage.trim(),
  });

  if (msgErr) return { ok: false, error: msgErr.message };

  revalidatePath("/messages");
  return { ok: true, id: convId };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner – send a reply
// ─────────────────────────────────────────────────────────────────────────────

export async function sendOwnerMessage(
  conversationId: string,
  gymId: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!content.trim()) return { ok: false, error: "Message cannot be empty." };

  const admin = createAdminClient() as any;

  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!conv) return { ok: false, error: "Conversation not found." };

  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "owner",
    sender_id: gymId,
    content: content.trim(),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner – list students for multi-select
// ─────────────────────────────────────────────────────────────────────────────

export async function listStudentsForGym(gymId: string): Promise<StudentOption[]> {
  const admin = createAdminClient() as any;
  const { data } = await admin
    .from("students")
    .select("id, full_name, email")
    .eq("gym_id", gymId)
    .order("full_name", { ascending: true })
    .limit(500);
  return (data ?? []).map((s: any) => ({
    id: s.id,
    full_name: s.full_name ?? "Unknown",
    email: s.email ?? "",
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner/Admin – delete an entire thread (messages + participants + conversation)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteConversation(
  conversationId: string,
  gymId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Authorised if the caller has delete_thread permission OR is a platform admin
  const [permCheck, isPA] = await Promise.all([
    requirePermission("delete_thread"),
    isPlatformAdmin(),
  ]);
  if (!permCheck.ok && !isPA) {
    return { ok: false, error: "You don't have permission to delete threads." };
  }

  const admin = createAdminClient() as any;

  // Confirm the conversation belongs to this gym before touching anything
  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("gym_id", gymId)
    .maybeSingle();

  if (!conv) return { ok: false, error: "Conversation not found." };

  // Delete in dependency order so FK constraints are satisfied
  await admin.from("messages").delete().eq("conversation_id", conversationId);
  await admin.from("conversation_participants").delete().eq("conversation_id", conversationId);

  const { error } = await admin
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("gym_id", gymId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/messages");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Student – list their conversations
// ─────────────────────────────────────────────────────────────────────────────

export async function listStudentConversations(studentId: string): Promise<ConversationSummary[]> {
  const admin = createAdminClient() as any;

  const { data: partRows } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("student_id", studentId);

  if (!partRows || partRows.length === 0) return [];

  const convIds: string[] = partRows.map((p: any) => p.conversation_id);

  const [{ data: convs }, { data: allMessages }] = await Promise.all([
    admin
      .from("conversations")
      .select("id, subject, gym_id, created_at, updated_at")
      .in("id", convIds)
      .order("updated_at", { ascending: false }),
    admin
      .from("messages")
      .select("id, conversation_id, sender_type, content, read_at, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false }),
  ]);

  const messagesByConv: Record<string, any[]> = {};
  for (const m of allMessages ?? []) {
    if (!messagesByConv[m.conversation_id]) messagesByConv[m.conversation_id] = [];
    messagesByConv[m.conversation_id].push(m);
  }

  return (convs ?? []).map((c: any) => {
    const msgs = messagesByConv[c.id] ?? [];
    const lastMsg = msgs[0];
    const unread = msgs.filter((m: any) => m.sender_type === "owner" && !m.read_at).length;
    return {
      id: c.id,
      subject: c.subject ?? null,
      created_at: c.created_at,
      updated_at: c.updated_at,
      participants: [],
      last_message: lastMsg?.content ?? null,
      last_message_sender: lastMsg?.sender_type ?? null,
      unread_count: unread,
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Student – get conversation detail + mark owner messages as read
// ─────────────────────────────────────────────────────────────────────────────

export async function getStudentConversationDetail(
  conversationId: string,
  studentId: string,
): Promise<ConversationDetail | null> {
  const admin = createAdminClient() as any;

  // Verify student is a participant
  const { data: part } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!part) return null;

  const [{ data: conv }, { data: msgs }] = await Promise.all([
    admin
      .from("conversations")
      .select("id, subject, gym_id")
      .eq("id", conversationId)
      .maybeSingle(),
    admin
      .from("messages")
      .select("id, conversation_id, sender_type, sender_id, content, read_at, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);

  if (!conv) return null;

  // Mark unread owner messages as read
  const unreadIds = (msgs ?? [])
    .filter((m: any) => m.sender_type === "owner" && !m.read_at)
    .map((m: any) => m.id);
  if (unreadIds.length > 0) {
    await admin
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);
  }

  const messages: MessageRow[] = (msgs ?? []).map((m: any) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_type: m.sender_type as "owner" | "student",
    sender_id: m.sender_id,
    sender_name: m.sender_type === "owner" ? "Gym" : "You",
    content: m.content,
    read_at: m.read_at,
    created_at: m.created_at,
  }));

  return { id: conv.id, subject: conv.subject, gym_id: conv.gym_id, participants: [], messages };
}

// ─────────────────────────────────────────────────────────────────────────────
// Student – send a reply
// ─────────────────────────────────────────────────────────────────────────────

export async function sendStudentMessage(
  conversationId: string,
  studentId: string,
  content: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!content.trim()) return { ok: false, error: "Message cannot be empty." };

  const admin = createAdminClient() as any;

  const { data: part } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!part) return { ok: false, error: "You are not a participant in this conversation." };

  const { error } = await admin.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "student",
    sender_id: studentId,
    content: content.trim(),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/portal/messages/${conversationId}`);
  revalidatePath("/portal/messages");
  return { ok: true };
}
