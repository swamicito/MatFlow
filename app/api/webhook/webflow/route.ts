import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = body.name;
    const email = body.email || null;
    const phone = body.phone;
    const source = body.source || "Website";
    const notes = body.notes || null;

    if (!name || !phone) {
      return NextResponse.json(
        { success: false, error: "Name and phone are required" },
        { status: 400 }
      );
    }

    // Get the gym UUID
    const { data: gym, error: gymError } = await supabase
      .from("gyms")
      .select("id")
      .eq("slug", "asbury-park")
      .maybeSingle();

    if (gymError || !gym) {
      return NextResponse.json(
        { success: false, error: "Asbury Park gym not found" },
        { status: 500 }
      );
    }

    const { error } = await supabase.from("leads").insert({
      name,
      email,
      phone,
      source,
      notes,
      status: "new",
      gym_id: gym.id,
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook crash:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
