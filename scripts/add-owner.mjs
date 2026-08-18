/**
 * scripts/add-owner.mjs
 *
 * One-off: add chris@methodjj.com as OWNER of Method Jiu-Jitsu.
 *
 * - Finds the gym by slug "method-jiu-jitsu-2" (fallback: name match).
 * - Gets or creates the Supabase auth user (service role).
 * - Upserts a user_gyms row (role=owner) — Method ONLY.
 * - Sets profiles.gym_id to Method only if the profile has no gym yet
 *   (never touches another gym's access).
 * - Does NOT touch Asbury Park, Steve's Gym, or any other user/gym.
 *
 * Usage:
 *   node scripts/add-owner.mjs            # dry run — reports only
 *   node scripts/add-owner.mjs --execute  # actually writes
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const EMAIL = "chris@methodjj.com";
const GYM_SLUG = "method-jiu-jitsu-2";
const GYM_NAME_MATCH = "Method Jiu Jitsu";
const EXECUTE = process.argv.includes("--execute");

// ── Load .env.local ──────────────────────────────────────────────────────────
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(root, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function findAuthUser(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const users = data?.users ?? [];
    const found = users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
    if (found?.id) return found.id;
    if (users.length < 1000) break;
  }
  return null;
}

async function getOrCreateAuthUser(email, allowCreate) {
  if (allowCreate) {
    // Strategy 1: createUser
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });
    if (created?.user?.id) return { userId: created.user.id, created: true };
    console.warn(`createUser failed: ${createErr?.message ?? "unknown"} — trying generateLink`);

    // Strategy 2: generateLink creates the user if missing
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkData?.user?.id) return { userId: linkData.user.id, created: true };

    // Strategy 3: maybe it existed all along
    const existing = await findAuthUser(email);
    if (existing) return { userId: existing, created: false };
    throw new Error(`Cannot get-or-create auth user for ${email}: ${createErr?.message ?? "unknown"}`);
  }
  const existing = await findAuthUser(email);
  if (!existing) return { userId: null, created: false };
  return { userId: existing, created: false };
}

async function main() {
  console.log(EXECUTE ? "=== EXECUTE MODE ===" : "=== DRY RUN (no changes) ===");

  // 1. Find the gym ──────────────────────────────────────────────────────────
  let { data: gym } = await supabase
    .from("gyms")
    .select("id, name, slug")
    .eq("slug", GYM_SLUG)
    .maybeSingle();

  if (!gym) {
    const { data: byName } = await supabase
      .from("gyms")
      .select("id, name, slug")
      .ilike("name", `%${GYM_NAME_MATCH}%`);
    if (byName?.length === 1) gym = byName[0];
    if (byName?.length > 1) {
      throw new Error(`Ambiguous gym name match: ${byName.map((g) => g.slug).join(", ")}`);
    }
  }
  if (!gym) throw new Error(`Gym not found (slug=${GYM_SLUG}, name~${GYM_NAME_MATCH})`);
  console.log(`Gym: ${gym.name} (${gym.slug}) id=${gym.id}`);

  // 2. Get-or-create auth user ───────────────────────────────────────────────
  const { userId, created } = await getOrCreateAuthUser(EMAIL, EXECUTE);
  if (!userId) {
    console.log(`Auth user: ${EMAIL} does not exist yet — WOULD create on --execute, then link as owner.`);
    console.log("Dry run complete — re-run with --execute to apply.");
    return;
  }
  console.log(`Auth user: ${userId} (${created ? "created" : "already existed"})`);

  // 3. Current links — verify scope before/after ─────────────────────────────
  const { data: linksBefore } = await supabase
    .from("user_gyms")
    .select("gym_id, role, gyms(name, slug)")
    .eq("user_id", userId);
  console.log("Existing gym links:", JSON.stringify(linksBefore ?? [], null, 2));

  const existingMethod = (linksBefore ?? []).find((l) => l.gym_id === gym.id);
  if (existingMethod?.role === "owner") {
    console.log("Already an owner of Method — nothing to do.");
  } else {
    console.log(
      EXECUTE
        ? `Linking as owner (existing link role: ${existingMethod?.role ?? "none"})…`
        : `WOULD link user as owner of Method (existing link role: ${existingMethod?.role ?? "none"})`,
    );
    if (EXECUTE) {
      const { error } = await supabase
        .from("user_gyms")
        .upsert(
          { user_id: userId, gym_id: gym.id, role: "owner" },
          { onConflict: "user_id,gym_id" },
        );
      if (error) throw new Error(`user_gyms upsert failed: ${error.message}`);
    }
  }

  // 4. Profile — only set gym_id if the profile has none ─────────────────────
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, gym_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    console.log(EXECUTE ? "Creating profile (gym=Method, role=owner)…" : "WOULD create profile (gym=Method, role=owner)");
    if (EXECUTE) {
      const { error } = await supabase
        .from("profiles")
        .insert({ id: userId, gym_id: gym.id, role: "owner" });
      if (error) throw new Error(`profile insert failed: ${error.message}`);
    }
  } else if (!profile.gym_id) {
    console.log(EXECUTE ? "Setting profile.gym_id → Method…" : "WOULD set profile.gym_id → Method");
    if (EXECUTE) {
      const { error } = await supabase
        .from("profiles")
        .update({ gym_id: gym.id })
        .eq("id", userId);
      if (error) throw new Error(`profile update failed: ${error.message}`);
    }
  } else {
    console.log(`Profile already has gym_id=${profile.gym_id} — leaving it untouched.`);
  }

  // 5. Verify ────────────────────────────────────────────────────────────────
  const { data: linksAfter } = await supabase
    .from("user_gyms")
    .select("gym_id, role, gyms(name, slug)")
    .eq("user_id", userId);
  console.log("Final gym links:", JSON.stringify(linksAfter ?? [], null, 2));

  console.log(EXECUTE ? "Done. Chris can now log in at /login with his email." : "Dry run complete — re-run with --execute to apply.");
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
