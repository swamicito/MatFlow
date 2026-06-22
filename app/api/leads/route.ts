/**
 * POST /api/leads
 *
 * Universal lead-creation endpoint. Accepts submissions from any source:
 * Webflow, Typeform, custom landing pages, or the future JS tracking snippet.
 *
 * Authentication:
 *   Pass the shared secret in the `X-Api-Key` request header, OR as
 *   `api_key` in the JSON body. The secret is set via the LEADS_API_SECRET
 *   environment variable.
 *
 * Required body fields:
 *   name       string   — lead's full name
 *   gym_slug   string   — slug of the destination gym  (e.g. "method-bjj")
 *              OR
 *   gym_id     string   — UUID of the destination gym
 *
 * Optional body fields:
 *   email, phone, source, notes
 *   utm_source, utm_medium, utm_campaign, utm_term, utm_content
 *   landing_page, referrer, source_label
 *
 * Response:
 *   200  { ok: true }
 *   400  { ok: false, error: "..." }   — validation failure
 *   401  { ok: false, error: "Unauthorized" }
 *   500  { ok: false, error: "..." }   — server error
 *
 * Example cURL:
 *   curl -X POST https://mat-flow.net/api/leads \
 *     -H "Content-Type: application/json" \
 *     -H "X-Api-Key: $LEADS_API_SECRET" \
 *     -d '{ "gym_slug":"method-bjj", "name":"Jane Doe", "phone":"732-555-0101",
 *            "utm_source":"instagram", "utm_campaign":"summer2026",
 *            "landing_page":"https://methodbjj.com/intro" }'
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractUtmFromPayload } from "@/lib/utm-server";

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = await request.json();

    // ── Authentication ────────────────────────────────────────────────────────
    // The secret is checked against both the header and the body field so
    // platforms that can't set custom headers (e.g. some no-code tools) still
    // work by passing api_key in the JSON payload.
    const secret = process.env.LEADS_API_SECRET ?? "";
    if (!secret) {
      // If the env var is unset in production, fail closed for safety.
      console.error("[POST /api/leads] LEADS_API_SECRET is not configured");
      return NextResponse.json({ ok: false, error: "Endpoint not configured" }, { status: 500 });
    }

    const providedKey =
      request.headers.get("x-api-key") ??
      (typeof body.api_key === "string" ? body.api_key : "");

    if (providedKey !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // ── Required: name ────────────────────────────────────────────────────────
    const name = (body.name ?? "").trim();
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "'name' is required" },
        { status: 400 },
      );
    }

    // ── Required: gym identity ────────────────────────────────────────────────
    // Accept either a UUID gym_id (fast, no extra query) or a human-readable
    // gym_slug for platforms that embed the slug in their form hidden fields.
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    let gymId: string | null = null;

    if (body.gym_id && typeof body.gym_id === "string") {
      // Trust the caller's UUID — insert will fail with FK error if invalid.
      gymId = body.gym_id.trim();
    } else if (body.gym_slug && typeof body.gym_slug === "string") {
      const { data: gym } = await db
        .from("gyms")
        .select("id")
        .eq("slug", body.gym_slug.trim())
        .maybeSingle();
      gymId = gym?.id ?? null;
    }

    if (!gymId) {
      return NextResponse.json(
        { ok: false, error: "'gym_id' or 'gym_slug' is required and must match a known gym" },
        { status: 400 },
      );
    }

    // ── Optional standard fields ───────────────────────────────────────────────
    const email  = (body.email  ?? null) || null;
    const phone  = (body.phone  ?? null) || null;
    const source = (body.source ?? null) || null;
    const notes  = (body.notes  ?? null) || null;

    // ── UTM + attribution extraction ──────────────────────────────────────────
    // Handles standard names, camelCase variants, and human-friendly labels.
    // source_label is auto-generated from utm_source + utm_campaign when absent.
    const attribution = extractUtmFromPayload(body);

    // ── Insert lead ────────────────────────────────────────────────────────────
    const { error: insertError } = await db.from("leads").insert({
      gym_id: gymId,
      name,
      email,
      phone,
      source,
      notes,
      status: "new",
      utm_source:   attribution.utm_source,
      utm_medium:   attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_term:     attribution.utm_term,
      utm_content:  attribution.utm_content,
      landing_page: attribution.landing_page,
      referrer:     attribution.referrer,
      source_label: attribution.source_label,
    });

    if (insertError) {
      console.error("[POST /api/leads] insert error:", insertError);
      return NextResponse.json(
        { ok: false, error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/leads] crash:", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
