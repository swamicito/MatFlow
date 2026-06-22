import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractUtmFromPayload } from "@/lib/utm-server";

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: Record<string, any> = await request.json();

    // ── Required fields ────────────────────────────────────────────────────
    const name  = (body.name  ?? "").trim();
    const phone = (body.phone ?? "").trim();

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: "name and phone are required" },
        { status: 400 },
      );
    }

    const email  = (body.email  ?? null) || null;
    const notes  = (body.notes  ?? null) || null;
    // Allow the form to pass a custom source label; fall back to "Website".
    const source = (body.source ?? "Website") || "Website";

    // ── UTM + attribution extraction ───────────────────────────────────────
    // extractUtmFromPayload checks for standard UTM names (utm_source, etc.)
    // as well as camelCase and human-friendly variants sent by Webflow forms.
    // It also auto-generates source_label from utm_source + utm_campaign.
    const attribution = extractUtmFromPayload(body);

    // ── Gym lookup ─────────────────────────────────────────────────────────
    const supabase = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: gym, error: gymError } = await (supabase as any)
      .from("gyms")
      .select("id")
      .eq("slug", "asbury-park")
      .maybeSingle();

    if (gymError || !gym) {
      return NextResponse.json(
        { success: false, error: "Gym not found" },
        { status: 500 },
      );
    }

    // ── Insert lead ────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any).from("leads").insert({
      gym_id: gym.id,
      name,
      email,
      phone,
      source,
      notes,
      status: "new",
      // Attribution — all fields are null when not supplied by the form.
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
      console.error("[webflow webhook] insert error:", insertError);
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[webflow webhook] crash:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
