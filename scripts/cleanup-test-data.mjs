/**
 * scripts/cleanup-test-data.mjs
 *
 * Deletes all gyms EXCEPT the keep-list, plus their associated auth users.
 * Deleting a gym cascades to: students, leads, plans, memberships (via students),
 * attendance, waivers, conversations/messages, classes, products/purchases,
 * instructionals, challenges, passport data, automation rules/comms, user_gyms.
 *
 * Auth users are deleted explicitly (only if they have no remaining gym links).
 *
 * Usage:
 *   node scripts/cleanup-test-data.mjs            # dry run — reports only
 *   node scripts/cleanup-test-data.mjs --execute  # actually deletes
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KEEP_SLUGS = ["method-jiu-jitsu-2", "asbury-park"];
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

// ── Helpers ──────────────────────────────────────────────────────────────────
async function countRows(table, gymIds) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("gym_id", gymIds);
  return error ? `err:${error.message}` : count;
}

async function main() {
  console.log(EXECUTE ? "=== EXECUTE MODE ===" : "=== DRY RUN (no changes) ===");

  // 1. List all gyms
  const { data: gyms, error: gymErr } = await supabase
    .from("gyms")
    .select("id, name, slug, created_at")
    .order("created_at");
  if (gymErr) throw new Error(`Failed to list gyms: ${gymErr.message}`);

  const keep   = gyms.filter((g) => KEEP_SLUGS.includes(g.slug));
  const doomed = gyms.filter((g) => !KEEP_SLUGS.includes(g.slug));

  console.log(`\nKEEP (${keep.length}):`);
  keep.forEach((g) => console.log(`  ✓ ${g.name} (${g.slug})`));
  console.log(`\nDELETE (${doomed.length}):`);
  doomed.forEach((g) => console.log(`  ✗ ${g.name} (${g.slug}) — created ${g.created_at}`));

  if (keep.length !== KEEP_SLUGS.length) {
    throw new Error(
      `Expected ${KEEP_SLUGS.length} keep gyms, found ${keep.length}. Aborting.`,
    );
  }
  if (doomed.length === 0) {
    console.log("\nNothing to delete.");
    return;
  }

  const doomedIds = doomed.map((g) => g.id);

  // 2. Report related data volume
  console.log("\nRelated rows that will be cascade-deleted:");
  for (const t of [
    "students", "leads", "membership_plans", "family_accounts",
    "conversations", "classes", "products", "purchases",
    "instructionals", "challenges", "automation_rules", "communications",
    "user_gyms", "waiver_templates", "user_passport", "passport_challenges",
  ]) {
    console.log(`  ${t}: ${await countRows(t, doomedIds)}`);
  }

  // 3. Collect auth users tied to doomed gyms
  const { data: links } = await supabase
    .from("user_gyms")
    .select("user_id, gym_id")
    .in("gym_id", doomedIds);
  const candidateUserIds = [...new Set((links ?? []).map((l) => l.user_id))];

  const { data: doomedStudents } = await supabase
    .from("students")
    .select("id")
    .in("gym_id", doomedIds);
  const doomedStudentIds = (doomedStudents ?? []).map((s) => s.id);

  let studentAuthIds = [];
  if (doomedStudentIds.length > 0) {
    const { data: sa } = await supabase
      .from("student_auth")
      .select("auth_user_id")
      .in("student_id", doomedStudentIds);
    studentAuthIds = (sa ?? []).map((r) => r.auth_user_id);
  }
  const allCandidateUsers = [...new Set([...candidateUserIds, ...studentAuthIds])];

  // Only delete users who will have NO remaining links after gym deletion
  const { data: survivingLinks } = await supabase
    .from("user_gyms")
    .select("user_id")
    .in("user_id", allCandidateUsers.length ? allCandidateUsers : ["00000000-0000-0000-0000-000000000000"])
    .not("gym_id", "in", `(${doomedIds.join(",")})`);
  const survivingUserIds = new Set((survivingLinks ?? []).map((l) => l.user_id));

  const usersToDelete = allCandidateUsers.filter((id) => !survivingUserIds.has(id));
  const usersToKeep   = allCandidateUsers.filter((id) =>  survivingUserIds.has(id));

  console.log(`\nAuth users to delete: ${usersToDelete.length}`);
  console.log(`Auth users kept (still linked to a kept gym): ${usersToKeep.length}`);

  // 4. Memberships (plan_id is ON DELETE RESTRICT — must go first)
  const { count: membershipCount } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .in("student_id", doomedStudentIds.length ? doomedStudentIds : ["00000000-0000-0000-0000-000000000000"]);
  console.log(`Memberships to delete explicitly: ${membershipCount ?? 0}`);

  if (!EXECUTE) {
    console.log("\nDry run complete. Re-run with --execute to apply.");
    return;
  }

  // ── EXECUTE ────────────────────────────────────────────────────────────────
  console.log("\nDeleting memberships (FK RESTRICT guard)...");
  if (doomedStudentIds.length > 0) {
    const { error } = await supabase
      .from("memberships")
      .delete()
      .in("student_id", doomedStudentIds);
    if (error) throw new Error(`memberships delete failed: ${error.message}`);
  }

  console.log("Deleting gyms (cascades everything else)...");
  const { error: delErr } = await supabase
    .from("gyms")
    .delete()
    .in("id", doomedIds);
  if (delErr) throw new Error(`gyms delete failed: ${delErr.message}`);

  console.log("Deleting auth users...");
  let deletedUsers = 0;
  for (const uid of usersToDelete) {
    const { error } = await supabase.auth.admin.deleteUser(uid);
    if (error) console.error(`  Failed to delete user ${uid}: ${error.message}`);
    else deletedUsers++;
  }

  // 5. Verify
  const { data: remaining } = await supabase
    .from("gyms")
    .select("name, slug")
    .order("created_at");

  console.log(`\n=== DONE ===`);
  console.log(`Gyms deleted: ${doomed.length}`);
  console.log(`Auth users deleted: ${deletedUsers}/${usersToDelete.length}`);
  console.log(`Remaining gyms (${remaining.length}):`);
  remaining.forEach((g) => console.log(`  ✓ ${g.name} (${g.slug})`));
}

main().catch((e) => {
  console.error("CLEANUP FAILED:", e.message);
  process.exit(1);
});
