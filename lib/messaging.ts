import { Resend } from 'resend';

// ─────────────────────────────────────────────────────────────
// Types (kept identical for backward compatibility)
// ─────────────────────────────────────────────────────────────

export type SendResult =
  | {
      ok: true;
      status: "sent" | "simulated";
      providerId: string | null;
    }
  | {
      ok: false;
      status: "failed";
      error: string;
    };

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;           // plain text
  html?: string;          // optional HTML version
  fromName?: string;
};

export type SendSmsInput = {
  to: string;
  body: string;
};

// ─────────────────────────────────────────────────────────────
// Email — Now using official Resend SDK
// ─────────────────────────────────────────────────────────────

export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_ADDRESS ?? "MatFlow <onboarding@resend.dev>";

  // Fallback to simulated mode if no API key
  if (!apiKey) {
    console.log("[EMAIL SIMULATED]", { to: input.to, subject: input.subject });
    return { ok: true, status: "simulated", providerId: null };
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: input.fromName ? `${input.fromName} <${from}>` : from,
      to: [input.to],
      subject: input.subject,
      text: input.body,
      html: input.html, // Use HTML if provided, otherwise Resend will auto-generate from text
    });

    if (error) {
      return {
        ok: false,
        status: "failed",
        error: error.message,
      };
    }

    return {
      ok: true,
      status: "sent",
      providerId: data?.id ?? null,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown email error",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// SMS — Twilio (unchanged)
// ─────────────────────────────────────────────────────────────

export async function sendSms(input: SendSmsInput): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { ok: true, status: "simulated", providerId: null };
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: input.to,
          From: from,
          Body: input.body,
        }).toString(),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        status: "failed",
        error: `Twilio ${res.status}: ${text.slice(0, 240)}`,
      };
    }

    const json = (await res.json().catch(() => null)) as { sid?: string } | null;
    return {
      ok: true,
      status: "sent",
      providerId: json?.sid ?? null,
    };
  } catch (err: unknown) {
    return {
      ok: false,
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown SMS error",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────

export function isProviderConfigured(channel: "email" | "sms"): boolean {
  if (channel === "email") return !!process.env.RESEND_API_KEY;
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}