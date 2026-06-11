"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { RULE_BY_KEY } from "@/lib/automation-defaults";
import { isProviderConfigured, sendEmail, sendSms } from "@/lib/messaging";
import { renderTemplate } from "@/lib/templates";
import type { AutomationRuleKey, CommStatus } from "@/lib/supabase/types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type ConversionTriggerType = "fourth_class" | "ten_visits";

// ─────────────────────────────────────────────────────────────
// Main entry point — called after every successful check-in
// ─────────────────────────────────────────────────────────────

export async function maybeFireConversionTriggers(
  studentId: string,
): Promise<void> {
  const supabase = createAdminClient() as any;
  const gymId = await getCurrentGymId();
  if (!gymId) return;

  // Count total attendance for this student
  const { count: totalClasses } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId);

  if (totalClasses == null) return;

  // Fetch student name + gym settings in parallel
  const [{ data: student }, { data: gym }] = await Promise.all([
    supabase
      .from("students")
      .select("full_name, email, phone")
      .eq("id", studentId)
      .maybeSingle(),
    supabase
      .from("gyms")
      .select("free_class_nudge_after")
      .eq("id", gymId)
      .maybeSingle(),
  ]);
  if (!student) return;

  const firstName = student.full_name.split(" ")[0] ?? "there";
  const freeClassThreshold: number = gym?.free_class_nudge_after ?? 4;

  // ── Free class nudge trigger ──
  if (totalClasses === freeClassThreshold) {
    await fireTrigger({
      gymId,
      studentId,
      triggerType: "fourth_class",
      firstName,
      email: student.email,
      phone: student.phone,
    });
  }

  // ── 10 visits trigger ──
  if (totalClasses === 10) {
    await fireTrigger({
      gymId,
      studentId,
      triggerType: "ten_visits",
      firstName,
      email: student.email,
      phone: student.phone,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Internal: fire a single trigger (idempotent via unique constraint)
// ─────────────────────────────────────────────────────────────

async function fireTrigger(params: {
  gymId: string;
  studentId: string;
  triggerType: ConversionTriggerType;
  firstName: string;
  email: string | null;
  phone: string | null;
}): Promise<void> {
  const { gymId, studentId, triggerType, firstName, email, phone } = params;
  const supabase = createAdminClient() as any;

  // Check if already triggered (idempotency)
  const { data: existing } = await supabase
    .from("automation_triggers")
    .select("id, sent")
    .eq("student_id", studentId)
    .eq("trigger_type", triggerType)
    .maybeSingle();

  if (existing) {
    // Already triggered — nothing to do
    return;
  }

// Insert trigger row (unique constraint prevents duplicates)
const { error: insertErr } = await supabase
  .from("automation_triggers")
  .insert({
    gym_id: gymId,
    student_id: studentId,
    trigger_type: triggerType,
  } as any); // eslint-disable-line @typescript-eslint/no-explicit-any

  if (insertErr) {
    // If duplicate key race condition, just return
    if (insertErr.code === "23505") return;
    console.error("[conversion-triggers] insert error:", insertErr);
    return;
  }

  // Fetch the rule configuration
  const ruleKey: AutomationRuleKey = triggerType;
  const ruleDef = RULE_BY_KEY[ruleKey];
  if (!ruleDef) {
    console.warn(`[conversion-triggers] No rule definition for ${triggerType}`);
    return;
  }

  const { data: rule } = await supabase
    .from("automation_rules")
    .select(
      "enabled, channel_email, channel_sms, email_subject, email_body, sms_body",
    )
    .eq("gym_id", gymId)
    .eq("rule_key", ruleKey)
    .maybeSingle();

  if (!rule || !rule.enabled) {
    // Rule disabled or not configured — mark trigger as not sent
    return;
  }

  // Fetch gym name + google review url
  const { data: gym } = await supabase
    .from("gyms")
    .select("name, google_review_url")
    .eq("id", gymId)
    .maybeSingle();

  const gymName = gym?.name ?? "Your Gym";
  const reviewUrl = gym?.google_review_url ?? "";

  // Build template variables
  const vars: Record<string, string> = {
    gym_name: gymName,
    first_name: firstName,
    student_name: firstName,
    review_link: reviewUrl || "(ask your coach for the link)",
    offer_link: "(ask your coach for the link)",
  };

  const result: { email?: { status: CommStatus; error: string | null }; sms?: { status: CommStatus; error: string | null } } =
    {};

  // Send Email
  if (rule.channel_email && email) {
    const subject = renderTemplate(rule.email_subject ?? "", vars);
    const body = renderTemplate(rule.email_body ?? "", vars);
    const r = await sendEmail({ to: email, subject, body });
    await supabase.from("communications").insert({
      gym_id: gymId,
      rule_key: ruleKey,
      channel: "email",
      status: r.ok ? r.status : "failed",
      recipient_id: studentId,
      recipient_kind: "student",
      to_address: email,
      subject,
      body,
      provider_id: r.ok ? r.providerId : null,
      error: r.ok ? null : r.error,
    });
    result.email = { status: r.ok ? r.status : "failed", error: r.ok ? null : r.error };
  }

  // Send SMS
  if (rule.channel_sms && phone) {
    const body = renderTemplate(rule.sms_body ?? "", vars);
    const r = await sendSms({ to: phone, body });
    await supabase.from("communications").insert({
      gym_id: gymId,
      rule_key: ruleKey,
      channel: "sms",
      status: r.ok ? r.status : "failed",
      recipient_id: studentId,
      recipient_kind: "student",
      to_address: phone,
      subject: null,
      body,
      provider_id: r.ok ? r.providerId : null,
      error: r.ok ? null : r.error,
    });
    result.sms = { status: r.ok ? r.status : "failed", error: r.ok ? null : r.error };
  }

  // Mark trigger as sent
  await supabase
    .from("automation_triggers")
    .update({ sent: true })
    .eq("student_id", studentId)
    .eq("trigger_type", triggerType);
}
