/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendSms, isProviderConfigured } from "@/lib/messaging";

/**
 * Notifies students when staff (owner) sends them a message.
 *
 * Guarantees:
 *  - Gym-scoped: participants are resolved through the conversation's own
 *    gym_id — students from other gyms can never be notified.
 *  - Debounced: at most one notification per student per conversation per
 *    DEBOUNCE_MINUTES, persisted in message_notifications (survives restarts).
 *  - Non-blocking semantics: callers should fire-and-forget (or catch) — a
 *    notification failure must never fail the message send itself.
 *  - Email via Resend (branded). SMS via Twilio only when configured; SMS
 *    never blocks email and vice-versa.
 */

const DEBOUNCE_MINUTES = 10;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mat-flow.net";

type NotifyInput = {
  conversationId: string;
  gymId: string;
  /** The staff message content (used as the preview). */
  content: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function notifyHtml(gymName: string, preview: string, url: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>New message from ${escapeHtml(gymName)}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;">
<tr><td align="center" bgcolor="#000000" style="background-color:#000000;padding:56px 24px 64px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;padding-bottom:40px;">
      <a href="${SITE}" style="text-decoration:none;">
        <img src="${SITE}/logo-full.png" alt="MatFlow" width="180" height="35"
             style="display:block;border:0;outline:none;width:180px;height:35px;" />
      </a>
    </td></tr>
    <tr><td bgcolor="#0a0a0a" style="background-color:#0a0a0a;border:1px solid #1f1f1f;border-radius:16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="padding:44px 36px 0;">
          <h1 style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;font-weight:700;line-height:1.3;color:#ffffff;letter-spacing:-0.3px;">
            New message from ${escapeHtml(gymName)}
          </h1>
        </td></tr>
        <tr><td align="center" style="padding:20px 36px 8px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#9CA3AF;font-style:italic;">
            &ldquo;${escapeHtml(preview)}&rdquo;
          </p>
        </td></tr>
        <tr><td align="center" style="padding:24px 36px 44px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
            <tr>
              <td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:10px;">
                <a href="${url}"
                   style="display:inline-block;padding:14px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#000000;text-decoration:none;">
                  View message &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="center" bgcolor="#000000" style="background-color:#000000;padding-top:32px;">
      <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#6B7280;">
        You received this because ${escapeHtml(gymName)} messaged you on MatFlow.<br>
        Questions? <a href="mailto:support@mat-flow.net" style="color:#9CA3AF;text-decoration:underline;">support@mat-flow.net</a>
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export async function notifyStudentsOfOwnerMessage(input: NotifyInput): Promise<void> {
  const tag = `[messaging] conversation=${input.conversationId}`;
  const admin = createAdminClient() as any;

  // Resolve the conversation strictly by (id, gym_id) — a mismatched gym_id
  // finds nothing, so cross-gym notification is structurally impossible.
  const { data: conv } = await admin
    .from("conversations")
    .select("id, gym_id, gyms(name)")
    .eq("id", input.conversationId)
    .eq("gym_id", input.gymId)
    .maybeSingle();

  if (!conv) {
    console.log(`${tag} result=skipped reason=conversation_not_in_gym`);
    return;
  }

  const gymName: string =
    (Array.isArray(conv.gyms) ? conv.gyms[0]?.name : conv.gyms?.name) ?? "Your gym";
  const portalUrl = `${SITE}/portal/messages/${input.conversationId}`;
  const preview = input.content.length > 140 ? `${input.content.slice(0, 137)}…` : input.content;

  // Participants of THIS conversation only, with contact details.
  const { data: parts } = await admin
    .from("conversation_participants")
    .select("student_id, students(id, full_name, email, phone, gym_id)")
    .eq("conversation_id", input.conversationId);

  const students = (parts ?? [])
    .map((p: any) => (Array.isArray(p.students) ? p.students[0] : p.students))
    .filter((s: any) => s && s.gym_id === input.gymId); // belt-and-braces gym check

  if (students.length === 0) {
    console.log(`${tag} result=skipped reason=no_participants`);
    return;
  }

  // Debounce: one row per (conversation, student); skip anyone notified within the window.
  const cutoff = new Date(Date.now() - DEBOUNCE_MINUTES * 60 * 1000).toISOString();
  const { data: recent } = await admin
    .from("message_notifications")
    .select("student_id, last_notified_at")
    .eq("conversation_id", input.conversationId)
    .gte("last_notified_at", cutoff);
  const recentlyNotified = new Set((recent ?? []).map((r: any) => r.student_id as string));

  const smsConfigured = isProviderConfigured("sms");
  if (!smsConfigured) {
    console.log(
      `${tag} sms=skipped reason=twilio_not_configured ` +
      `(needs TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)`,
    );
  }

  for (const s of students) {
    const stag = `${tag} email=${s.email ?? "none"}`;

    if (recentlyNotified.has(s.id)) {
      console.log(`${stag} result=skipped reason=debounced`);
      continue;
    }

    let didNotify = false;

    // ── Email ──
    if (!s.email) {
      console.log(`${stag} result=skipped reason=no_email`);
    } else {
      const r = await sendEmail({
        to: s.email,
        fromName: "MatFlow",
        subject: `New message from ${gymName}`,
        body: [
          `Hi${s.full_name ? ` ${s.full_name.split(" ")[0]}` : ""},`,
          ``,
          `${gymName} sent you a message:`,
          ``,
          `"${preview}"`,
          ``,
          `View and reply: ${portalUrl}`,
        ].join("\n"),
        html: notifyHtml(gymName, preview, portalUrl),
      });
      didNotify = didNotify || r.ok;
      console.log(`${stag} result=${r.ok ? (r.status === "simulated" ? "simulated" : "sent") : `failed`}${r.ok ? "" : ` error=${(r as any).error}`}`);
    }

    // ── SMS (independent of email; never blocks it) ──
    if (smsConfigured && s.phone) {
      const r = await sendSms({
        to: s.phone,
        body: `${gymName}: "${preview.slice(0, 100)}" — view: ${portalUrl}`,
      });
      didNotify = didNotify || r.ok;
      console.log(`${stag} sms=${r.ok ? "sent" : "failed"}`);
    }

    // Stamp the debounce window only when something actually went out.
    if (didNotify) {
      await admin.from("message_notifications").upsert(
        {
          conversation_id: input.conversationId,
          student_id: s.id,
          last_notified_at: new Date().toISOString(),
        },
        { onConflict: "conversation_id,student_id" },
      );
    }
  }
}
