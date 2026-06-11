"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import {
  PREVIEW_VARS,
  RULE_BY_KEY,
  RULE_DEFINITIONS,
} from "@/lib/automation-defaults";
import { isProviderConfigured, sendEmail, sendSms } from "@/lib/messaging";
import { renderTemplate } from "@/lib/templates";
import type {
  AutomationRuleKey,
  CommChannel,
  CommStatus,
  Database,
} from "@/lib/supabase/types";

// ─────────────────── Types ───────────────────

export type RuleRow = {
  id: string;
  rule_key: AutomationRuleKey;
  enabled: boolean;
  channel_email: boolean;
  channel_sms: boolean;
  email_subject: string;
  email_body: string;
  sms_body: string;
  delay_minutes: number;
};

export type AutomationState = {
  rules: RuleRow[];
  recent: CommunicationRow[];
  providers: { email: boolean; sms: boolean };
  freeClassNudgeAfter: number;
};

export type CommunicationRow = {
  id: string;
  rule_key: AutomationRuleKey | null;
  channel: CommChannel;
  status: CommStatus;
  to_address: string;
  subject: string | null;
  body: string;
  error: string | null;
  created_at: string;
};

// ─────────────────── Read state ───────────────────

export async function getAutomationState(): Promise<AutomationState | null> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return null;

  // Ensure every rule has a row — insert defaults on first read.
  const { data: existing } = await supabase
    .from("automation_rules")
    .select(
      "id, rule_key, enabled, channel_email, channel_sms, email_subject, email_body, sms_body, delay_minutes",
    )
    .eq("gym_id", gymId);

  const existingByKey = new Map((existing ?? []).map((r: any) => [r.rule_key, r]));
  const missing = RULE_DEFINITIONS.filter((d) => !existingByKey.has(d.key));

  if (missing.length > 0) {
    const inserts = missing.map((d) => ({
      gym_id: gymId,
      rule_key: d.key,
      enabled: d.default_enabled,
      channel_email: d.default_channel_email,
      channel_sms: d.default_channel_sms,
      email_subject: d.default_email_subject,
      email_body: d.default_email_body,
      sms_body: d.default_sms_body,
      delay_minutes: d.default_delay_minutes,
    }));
    await supabase.from("automation_rules").insert(inserts);
  }

  const [{ data: rules }, { data: gymSettings }] = await Promise.all([
    supabase
      .from("automation_rules")
      .select(
        "id, rule_key, enabled, channel_email, channel_sms, email_subject, email_body, sms_body, delay_minutes",
      )
      .eq("gym_id", gymId),
    supabase
      .from("gyms")
      .select("free_class_nudge_after")
      .eq("id", gymId)
      .maybeSingle(),
  ]);

  const freeClassNudgeAfter: number = gymSettings?.free_class_nudge_after ?? 4;

  const ordered: RuleRow[] = RULE_DEFINITIONS.map((d) => {
    const row = (rules ?? []).find((r: any) => r.rule_key === d.key);
    return {
      id: row?.id ?? "",
      rule_key: d.key,
      enabled: row?.enabled ?? d.default_enabled,
      channel_email: row?.channel_email ?? d.default_channel_email,
      channel_sms: row?.channel_sms ?? d.default_channel_sms,
      email_subject:
        row?.email_subject ?? d.default_email_subject,
      email_body: row?.email_body ?? d.default_email_body,
      sms_body: row?.sms_body ?? d.default_sms_body,
      delay_minutes: row?.delay_minutes ?? d.default_delay_minutes,
    };
  });

  const { data: recent } = await supabase
    .from("communications")
    .select(
      "id, rule_key, channel, status, to_address, subject, body, error, created_at",
    )
    .eq("gym_id", gymId)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    rules: ordered,
    recent: (recent ?? []) as CommunicationRow[],
    providers: {
      email: isProviderConfigured("email"),
      sms: isProviderConfigured("sms"),
    },
    freeClassNudgeAfter,
  };
}

// ─────────────────── Update rule ───────────────────

export type SaveRuleInput = {
  rule_key: AutomationRuleKey;
  enabled?: boolean;
  channel_email?: boolean;
  channel_sms?: boolean;
  email_subject?: string;
  email_body?: string;
  sms_body?: string;
  delay_minutes?: number;
};

export async function saveRule(
  input: SaveRuleInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const update: Database["public"]["Tables"]["automation_rules"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  if (input.enabled !== undefined) update.enabled = input.enabled;
  if (input.channel_email !== undefined) update.channel_email = input.channel_email;
  if (input.channel_sms !== undefined) update.channel_sms = input.channel_sms;
  if (input.email_subject !== undefined) update.email_subject = input.email_subject;
  if (input.email_body !== undefined) update.email_body = input.email_body;
  if (input.sms_body !== undefined) update.sms_body = input.sms_body;
  if (input.delay_minutes !== undefined) update.delay_minutes = input.delay_minutes;

  const { error } = await supabase
    .from("automation_rules")
    .update(update)
    .eq("gym_id", gymId)
    .eq("rule_key", input.rule_key);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/automation");
  return { ok: true };
}

export async function resetRuleToDefault(
  rule_key: AutomationRuleKey,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const def = RULE_BY_KEY[rule_key];
  if (!def) return { ok: false, error: "Unknown rule." };
  return saveRule({
    rule_key,
    enabled: def.default_enabled,
    channel_email: def.default_channel_email,
    channel_sms: def.default_channel_sms,
    email_subject: def.default_email_subject,
    email_body: def.default_email_body,
    sms_body: def.default_sms_body,
    delay_minutes: def.default_delay_minutes,
  });
}

// ─────────────────── Test send ───────────────────

export type TestSendInput = {
  rule_key: AutomationRuleKey;
  to_email: string | null;
  to_phone: string | null;
};

export type TestSendResult = {
  email?: { status: CommStatus; error: string | null };
  sms?: { status: CommStatus; error: string | null };
};

export async function sendTestForRule(
  input: TestSendInput,
): Promise<{ ok: true; result: TestSendResult } | { ok: false; error: string }> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const { data: rule } = await supabase
    .from("automation_rules")
    .select(
      "rule_key, channel_email, channel_sms, email_subject, email_body, sms_body",
    )
    .eq("gym_id", gymId)
    .eq("rule_key", input.rule_key)
    .maybeSingle();
  if (!rule) return { ok: false, error: "Rule not found — reload the page." };

  const result: TestSendResult = {};

  // Email
  if (rule.channel_email && input.to_email) {
    const subject = renderTemplate(
      rule.email_subject ?? "",
      PREVIEW_VARS,
    );
    const body = renderTemplate(rule.email_body ?? "", PREVIEW_VARS);
    const r = await sendEmail({ to: input.to_email, subject, body });
    await supabase.from("communications").insert({
      gym_id: gymId,
      rule_key: input.rule_key,
      channel: "email",
      status: r.ok ? r.status : "failed",
      recipient_kind: "manual",
      to_address: input.to_email,
      subject,
      body,
      provider_id: r.ok ? r.providerId : null,
      error: r.ok ? null : r.error,
    });
    result.email = {
      status: r.ok ? r.status : "failed",
      error: r.ok ? null : r.error,
    };
  }

  // SMS
  if (rule.channel_sms && input.to_phone) {
    const body = renderTemplate(rule.sms_body ?? "", PREVIEW_VARS);
    const r = await sendSms({ to: input.to_phone, body });
    await supabase.from("communications").insert({
      gym_id: gymId,
      rule_key: input.rule_key,
      channel: "sms",
      status: r.ok ? r.status : "failed",
      recipient_kind: "manual",
      to_address: input.to_phone,
      body,
      provider_id: r.ok ? r.providerId : null,
      error: r.ok ? null : r.error,
    });
    result.sms = {
      status: r.ok ? r.status : "failed",
      error: r.ok ? null : r.error,
    };
  }

  if (!result.email && !result.sms) {
    return {
      ok: false,
      error:
        "Nothing to send — enable a channel and provide a matching recipient.",
    };
  }

  revalidatePath("/settings/automation");
  return { ok: true, result };
}
