// Quick smoke test for RBAC route guards.
// Runs against http://localhost:3000 — call from a working Node install.

const BASE = "http://localhost:3000";
const ROLES = ["owner", "instructor", "front_desk"];
const PATHS = [
  "/dashboard",
  "/leads",
  "/students",
  "/billing",
  "/reports",
  "/settings",
  "/settings/automation",
  "/settings/team",
  "/settings/import",
  "/checkin",
];

for (const role of ROLES) {
  console.log(`\n=== ${role} ===`);
  for (const p of PATHS) {
    const res = await fetch(BASE + p, {
      redirect: "manual",
      headers: { cookie: `mf-role=${role}` },
    });
    const loc = res.headers.get("location") ?? "";
    const tail = loc ? ` → ${loc.replace(BASE, "")}` : "";
    console.log(`  ${p.padEnd(24)} ${res.status}${tail}`);
  }
}
