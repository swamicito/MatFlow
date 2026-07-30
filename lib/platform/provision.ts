/**
 * lib/platform/provision.ts
 *
 * Fully-automated provisioning for new MatFlow gym signups.
 * Called from the Stripe webhook after checkout.session.completed fires
 * for a platform_subscription purchase. Never called from browser code.
 *
 * Steps
 *  1. Get-or-create the Supabase auth user for the gym owner.
 *  2. Idempotency check — if the user already owns a gym, re-send the
 *     welcome email and return early (safe for webhook retries).
 *  3. Create the gym (onboarding_completed: false → wizard on first login).
 *  4. Link user as owner in user_gyms + profiles.
 *  5. Seed starter membership plans.
 *  6. Generate a Supabase magic link and send branded welcome email.
 *  7. Send admin notification.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/messaging";

// Always use the canonical production domain — never rely on NEXT_PUBLIC_SITE_URL
// which may point to the Vercel preview URL.
const CANONICAL_URL = "https://www.mat-flow.net";
const ADMIN_EMAIL   = process.env.MATFLOW_ADMIN_EMAIL ?? "steve@mat-flow.net";

// ─── Public types ─────────────────────────────────────────────────────────────

export type ProvisionInput = {
  gymName:              string;
  ownerName:            string;
  ownerEmail:           string;
  stripeSessionId:      string;
  stripePlan:           string;
  stripeInterval:       string;
  stripeCustomerId:     string | null;
  stripeSubscriptionId: string | null;
};

export type ProvisionResult =
  | { ok: true;  gymId: string; userId: string; alreadyProvisioned: boolean }
  | { ok: false; error: string };

// ─── Seed data ────────────────────────────────────────────────────────────────

const STARTER_PLANS = [
  { name: "Monthly Unlimited", price_cents: 15000, interval: "month" as const, description: "Unlimited classes every month." },
  { name: "3× Per Week",       price_cents: 10000, interval: "month" as const, description: "Up to 12 classes per month." },
  { name: "Kids Program",      price_cents: 10000, interval: "month" as const, description: "Youth classes for ages 4–14." },
  { name: "Foundations",       price_cents: 12000, interval: "month" as const, description: "Fundamentals track for brand-new students." },
  { name: "Drop-In Pass",      price_cents:  3000, interval: "week"  as const, description: "Single-week drop-in access." },
] as const;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function findUniqueSlug(supabase: any, gymName: string): Promise<string> {
  const base = slugify(gymName) || "gym";
  let slug    = base;
  for (let i = 2; i < 200; i++) {
    const { data } = await supabase.from("gyms").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }
  return slug;
}

async function getOrCreateAuthUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  email: string,
  fullName: string,
): Promise<{ userId: string; created: boolean }> {

  // ── Strategy 1: createUser ──────────────────────────────────────────────────
  console.log(`[provision/auth] Strategy 1: admin.createUser for ${email}`);
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (!createErr && newUser?.user?.id) {
    console.log(`[provision/auth] Strategy 1 OK: userId=${newUser.user.id}`);
    return { userId: newUser.user.id as string, created: true };
  }

  console.warn(
    `[provision/auth] Strategy 1 failed: ` +
    `code=${createErr?.code ?? "n/a"} ` +
    `status=${createErr?.status ?? "n/a"} ` +
    `message="${createErr?.message ?? "none"}" ` +
    `— trying Strategy 2 (generateLink)`,
  );

  // ── Strategy 2: generateLink(magiclink) ─────────────────────────────────────
  // admin.generateLink is Supabase's canonical get-or-create for magic link flows:
  // it creates the user if they don't exist, finds them if they do, and returns
  // the userId in both cases. This sidesteps the listUsers pagination problem.
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type:    "magiclink",
    email,
    options: {
      data:       { full_name: fullName },
      redirectTo: `${CANONICAL_URL}/auth/callback?next=/dashboard`,
    },
  });

  if (!linkErr && linkData?.user?.id) {
    console.log(`[provision/auth] Strategy 2 OK: userId=${linkData.user.id}`);
    return { userId: linkData.user.id as string, created: false };
  }

  console.warn(
    `[provision/auth] Strategy 2 failed: ` +
    `code=${linkErr?.code ?? "n/a"} ` +
    `status=${linkErr?.status ?? "n/a"} ` +
    `message="${linkErr?.message ?? "none"}" ` +
    `— trying Strategy 3 (listUsers scan)`,
  );

  // ── Strategy 3: paginated listUsers scan ────────────────────────────────────
  for (let page = 1; page <= 5; page++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: listData, error: listErr } = await (supabase.auth.admin.listUsers as any)({
      perPage: 1000,
      page,
    });
    if (listErr) {
      console.error(`[provision/auth] Strategy 3 listUsers page=${page} error: ${listErr.message}`);
      break;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const users: any[] = listData?.users ?? [];
    console.log(`[provision/auth] Strategy 3 page=${page}: ${users.length} users returned`);
    const found = users.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (found?.id) {
      console.log(`[provision/auth] Strategy 3 OK: found userId=${found.id} on page=${page}`);
      return { userId: found.id as string, created: false };
    }
    if (users.length < 1000) break; // no more pages
  }

  // All three strategies failed — include all error messages for diagnosis.
  throw new Error(
    `Cannot get-or-create auth user for "${email}". ` +
    `createUser: "${createErr?.message ?? "no error"}". ` +
    `generateLink: "${linkErr?.message ?? "no error"}". ` +
    `listUsers: no match found.`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateMagicLink(supabase: any, email: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.admin.generateLink({
      type:    "magiclink",
      email,
      options: { redirectTo: `${CANONICAL_URL}/auth/callback?next=/dashboard` },
    });
    if (error) {
      console.error(`[provision/magic-link] generateLink error: code=${error.code} message="${error.message}"`);
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = (data as any)?.properties?.action_link ?? null;
    if (!link) {
      console.warn(`[provision/magic-link] generateLink succeeded but action_link is missing — data keys: ${Object.keys(data ?? {}).join(", ")}`);
    }
    return link;
  } catch (err) {
    console.error(`[provision/magic-link] generateLink threw unexpectedly:`, err);
    return null;
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

function welcomeHtml(input: ProvisionInput, magicLink: string): string {
  const firstName = input.ownerName.split(" ")[0] || "there";
  const steps = [
    "Walk through a 2-minute setup wizard to confirm your gym details and timezone.",
    "Copy your one-line embed code and add your schedule to your website.",
    "Import your existing students with our CSV import tool.",
    "Start collecting memberships and running your gym from one place.",
  ];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your MatFlow workspace is ready</title>
</head>
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000000;min-height:100vh;">
<tr><td align="center" style="padding:48px 20px 64px;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">

    <!-- Logo -->
    <tr><td align="center" style="padding-bottom:36px;">
      <a href="${CANONICAL_URL}" style="text-decoration:none;">
        <img src="${CANONICAL_URL}/logo-full.png"
             alt="MatFlow"
             width="140"
             style="display:block;height:auto;border:0;max-width:140px;" />
      </a>
    </td></tr>

    <!-- Card -->
    <tr><td style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:16px;overflow:hidden;">

      <!-- Card body -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">

        <!-- Headline -->
        <tr><td style="padding:40px 40px 8px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;line-height:1.25;color:#ffffff;letter-spacing:-0.3px;">
            Your workspace is ready${firstName !== "there" ? `, ${firstName}` : ""}!
          </h1>
        </td></tr>

        <!-- Subtext -->
        <tr><td style="padding:12px 40px 32px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#9CA3AF;">
            <strong style="color:#ffffff;font-weight:600;">${input.gymName}</strong> is live on MatFlow.
            Click below to log&nbsp;in — no password needed.
          </p>
        </td></tr>

        <!-- CTA button -->
        <tr><td align="left" style="padding:0 40px 36px;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:#ffffff;border-radius:10px;">
                <a href="${magicLink}"
                   style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#000000;text-decoration:none;white-space:nowrap;letter-spacing:-0.1px;">
                  Log in to MatFlow &rarr;
                </a>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-top:1px solid #1a1a1a;font-size:0;">&nbsp;</td></tr>
          </table>
        </td></tr>

        <!-- What happens next -->
        <tr><td style="padding:28px 40px 8px;">
          <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#4B5563;">
            What happens next
          </p>
        </td></tr>

        <tr><td style="padding:12px 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0">
            ${steps.map((step, i) => `
            <tr>
              <td width="28" valign="top" style="padding:2px 12px 12px 0;">
                <span style="display:inline-block;width:20px;height:20px;background:#052e16;border:1px solid #14532d;border-radius:50%;font-size:10px;font-weight:700;color:#4ade80;text-align:center;line-height:20px;">${i + 1}</span>
              </td>
              <td style="padding:2px 0 12px;font-size:13px;line-height:1.6;color:#9CA3AF;">${step}</td>
            </tr>`).join("")}
          </table>
        </td></tr>

        <!-- Link expiry note -->
        <tr><td style="padding:0 40px 36px;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#4B5563;">
            This link expires in 24&nbsp;hours. After that, you can
            <a href="${CANONICAL_URL}/login" style="color:#6B7280;text-decoration:underline;">request a new one</a>.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;border-top:1px solid #1a1a1a;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:#4B5563;">
            Questions? Email us at
            <a href="mailto:support@mat-flow.net" style="color:#6B7280;text-decoration:underline;">support@mat-flow.net</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
    <!-- / Card -->

    <!-- Bottom wordmark -->
    <tr><td align="center" style="padding-top:32px;">
      <p style="margin:0;font-size:11px;color:#333333;letter-spacing:0.08em;">
        MATFLOW &mdash; Gym Management Software
      </p>
    </td></tr>

  </table>
</td></tr>
</table>

</body>
</html>`;
}

async function sendWelcomeEmail(input: ProvisionInput, magicLink: string): Promise<void> {
  const firstName = input.ownerName.split(" ")[0] || "there";
  await sendEmail({
    to:       input.ownerEmail,
    fromName: "MatFlow",
    subject:  `Your MatFlow workspace for ${input.gymName} is ready`,
    body:
      `Hi ${firstName},\n\n` +
      `Your MatFlow workspace for ${input.gymName} is live.\n\n` +
      `Log in here (no password needed — link expires in 24 h):\n${magicLink}\n\n` +
      `After you log in, a quick wizard will walk you through the last setup steps.\n\n` +
      `Questions? Reply to this email.\n\n— The MatFlow Team`,
    html: welcomeHtml(input, magicLink),
  });
}

async function sendAdminNotification(input: ProvisionInput, gymId: string): Promise<void> {
  const planLabel: Record<string, string> = { starter: "Starter", pro: "Pro", growth: "Growth" };
  await sendEmail({
    to:      ADMIN_EMAIL,
    subject: `[MatFlow] New signup — ${input.gymName}`,
    body:
      `New gym provisioned automatically.\n\n` +
      `Gym:      ${input.gymName}\n` +
      `Owner:    ${input.ownerName} <${input.ownerEmail}>\n` +
      `Plan:     ${planLabel[input.stripePlan] ?? input.stripePlan} · ${input.stripeInterval}\n` +
      `Gym ID:   ${gymId}\n` +
      `Session:  ${input.stripeSessionId}\n` +
      `Customer: ${input.stripeCustomerId ?? "—"}\n` +
      `Sub:      ${input.stripeSubscriptionId ?? "—"}\n\n` +
      `Admin: ${CANONICAL_URL}/admin/signups`,
  });
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function provisionPlatformGym(input: ProvisionInput): Promise<ProvisionResult> {
  console.log(`[provision] START — gym="${input.gymName}" owner=${input.ownerEmail} session=${input.stripeSessionId}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // 1. Get or create auth user ────────────────────────────────────────────────
  console.log(`[provision] Step 1: get-or-create auth user for ${input.ownerEmail}`);
  let userId: string;
  let userCreated: boolean;
  try {
    const r = await getOrCreateAuthUser(supabase, input.ownerEmail, input.ownerName);
    userId      = r.userId;
    userCreated = r.created;
    console.log(`[provision] Step 1 OK: userId=${userId} created=${userCreated}`);
  } catch (err) {
    console.error("[provision] Step 1 FAILED:", err);
    return { ok: false, error: err instanceof Error ? err.message : "Auth user creation failed." };
  }

  // 2. Idempotency — existing owner? Re-send email and return early ───────────
  if (!userCreated) {
    console.log(`[provision] Step 2: user existed — checking for existing gym ownership`);
    const { data: existingOwnership } = await supabase
      .from("user_gyms")
      .select("gym_id")
      .eq("user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    if (existingOwnership?.gym_id) {
      console.log(`[provision] Step 2: already provisioned gymId=${existingOwnership.gym_id} — re-sending welcome email`);
      const magicLink = await generateMagicLink(supabase, input.ownerEmail);
      console.log(`[provision] Magic link for re-send: ${magicLink ? "generated" : "FAILED — using /login fallback"}`);
      await sendWelcomeEmail(input, magicLink ?? `${CANONICAL_URL}/login`).catch((e) =>
        console.error("[provision] Re-send welcome email FAILED:", e),
      );
      return { ok: true, gymId: existingOwnership.gym_id as string, userId, alreadyProvisioned: true };
    }
    console.log(`[provision] Step 2: no existing gym — proceeding with full provisioning`);
  }

  // 3. Create gym — onboarding_completed: false so wizard runs on first login ──
  const slug = await findUniqueSlug(supabase, input.gymName);
  console.log(`[provision] Step 3: creating gym slug="${slug}"`);
  const { data: gym, error: gymErr } = await supabase
    .from("gyms")
    .insert({
      name:                   input.gymName.trim(),
      slug,
      timezone:               "America/New_York",
      free_class_nudge_after: 3,
      onboarding_completed:   false,
    })
    .select("id")
    .single();

  if (gymErr || !gym) {
    console.error("[provision] Step 3 FAILED:", gymErr);
    return { ok: false, error: gymErr?.message ?? "Failed to create gym record." };
  }
  const gymId = gym.id as string;
  console.log(`[provision] Step 3 OK: gymId=${gymId}`);

  // 4. Link user as owner ─────────────────────────────────────────────────────
  console.log(`[provision] Step 4: linking user as owner`);
  const { error: ugErr } = await supabase
    .from("user_gyms")
    .insert({ gym_id: gymId, user_id: userId, role: "owner" });
  if (ugErr) console.error("[provision] Step 4 user_gyms insert error (non-fatal):", ugErr);

  const { error: profErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, gym_id: gymId, full_name: input.ownerName.trim(), role: "owner" });
  if (profErr) console.error("[provision] Step 4 profiles upsert error (non-fatal):", profErr);

  // 5. Seed starter membership plans ─────────────────────────────────────────
  console.log(`[provision] Step 5: seeding ${STARTER_PLANS.length} membership plans`);
  const { error: plansErr } = await supabase
    .from("membership_plans")
    .insert(STARTER_PLANS.map((p) => ({ ...p, gym_id: gymId })));
  if (plansErr) console.error("[provision] Step 5 plans seed error (non-fatal):", plansErr);
  else console.log(`[provision] Step 5 OK: ${STARTER_PLANS.length} plans seeded`);

  // 6. Magic link + welcome email ─────────────────────────────────────────────
  console.log(`[provision] Step 6: generating magic link for ${input.ownerEmail}`);
  const magicLink = await generateMagicLink(supabase, input.ownerEmail);
  if (magicLink) {
    console.log(`[provision] Step 6: magic link generated OK`);
  } else {
    console.error(`[provision] Step 6: magic link generation FAILED — will use /login fallback in email`);
  }

  // Always send the welcome email — fallback to /login if magic link is unavailable.
  console.log(`[provision] Step 6: sending welcome email to ${input.ownerEmail}`);
  const emailResult = await sendWelcomeEmail(input, magicLink ?? `${CANONICAL_URL}/login`)
    .then(() => "sent")
    .catch((err) => { console.error("[provision] Step 6 welcome email FAILED:", err); return "failed"; });
  console.log(`[provision] Step 6: welcome email result = ${emailResult}`);

  // 7. Admin notification ─────────────────────────────────────────────────────
  console.log(`[provision] Step 7: sending admin notification to ${ADMIN_EMAIL}`);
  const adminResult = await sendAdminNotification(input, gymId)
    .then(() => "sent")
    .catch((err) => { console.error("[provision] Step 7 admin notification FAILED:", err); return "failed"; });
  console.log(`[provision] Step 7: admin notification result = ${adminResult}`);

  console.log(`[provision] DONE — "${input.gymName}" (${gymId}) provisioned for ${input.ownerEmail}. email=${emailResult}`);
  return { ok: true, gymId, userId, alreadyProvisioned: false };
}
