/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentGymId } from "@/lib/auth/current-gym";
import { getCurrentRole } from "@/lib/auth/current-role";
import { can } from "@/lib/permissions";

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string };

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

export async function updateBranding(input: {
  logo_url?: string | null;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  logo_bg_color?: string;
}): Promise<ActionResult> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners can update branding." };
  }

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const patch: Record<string, unknown> = {};

  if ("logo_url" in input) patch.logo_url = input.logo_url;

  if (input.primary_color !== undefined) {
    if (!isValidHex(input.primary_color))
      return { ok: false, error: "Invalid primary color — use a 6-digit hex like #ff0000." };
    patch.primary_color = input.primary_color;
  }
  if (input.secondary_color !== undefined) {
    if (!isValidHex(input.secondary_color))
      return { ok: false, error: "Invalid secondary color." };
    patch.secondary_color = input.secondary_color;
  }
  if (input.accent_color !== undefined) {
    if (!isValidHex(input.accent_color))
      return { ok: false, error: "Invalid accent color." };
    patch.accent_color = input.accent_color;
  }
  if (input.logo_bg_color !== undefined) {
    if (!isValidHex(input.logo_bg_color))
      return { ok: false, error: "Invalid logo background color." };
    patch.logo_bg_color = input.logo_bg_color;
  }

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = createAdminClient() as any;
  const { error } = await supabase.from("gyms").update(patch).eq("id", gymId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/branding");
  revalidatePath("/portal", "layout");
  return { ok: true };
}

export async function uploadGymLogo(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const role = await getCurrentRole();
  if (!can(role, "edit_settings")) {
    return { ok: false, error: "Only owners can upload a logo." };
  }

  const gymId = await getCurrentGymId();
  if (!gymId) return { ok: false, error: "No active gym." };

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "No file provided." };
  if (file.size > 2 * 1024 * 1024)
    return { ok: false, error: "Logo must be under 2 MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  if (!["png", "jpg", "jpeg", "webp", "svg"].includes(ext))
    return { ok: false, error: "Unsupported format. Use PNG, JPG, WebP, or SVG." };

  const supabase = createAdminClient() as any;

  // Ensure the public bucket exists (no-op if already there)
  await supabase.storage
    .createBucket("gym-assets", { public: true })
    .catch(() => {});

  const path = `${gymId}/logo.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadErr } = await supabase.storage
    .from("gym-assets")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadErr)
    return { ok: false, error: `Upload failed: ${uploadErr.message}` };

  const { data: urlData } = supabase.storage
    .from("gym-assets")
    .getPublicUrl(path);

  const url: string | undefined = urlData?.publicUrl;
  if (!url) return { ok: false, error: "Could not get public URL after upload." };

  const { error: updateErr } = await supabase
    .from("gyms")
    .update({ logo_url: url })
    .eq("id", gymId);

  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath("/settings/branding");
  revalidatePath("/portal", "layout");
  return { ok: true, data: { url } };
}
