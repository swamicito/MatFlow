import {
  buildProgressSnapshot,
  evaluateEarnedBadges,
  nextAttendanceMilestone,
  startOfWeek,
  addDays,
  toIsoDate,
} from "../lib/gamification";

// Use a fixed 'now' so the test is deterministic.
const now = new Date("2026-01-21T12:00:00Z"); // Wednesday
const monThis = startOfWeek(now);
console.log("week start (Mon):", toIsoDate(monThis)); // 2026-01-19

// 5 complete weeks (3 classes each), then 2 classes this week (under goal).
const dates: string[] = [];
for (let w = 1; w <= 5; w++) {
  const mon = addDays(monThis, -7 * w);
  for (let i = 0; i < 3; i++) dates.push(toIsoDate(addDays(mon, i)));
}
dates.push(toIsoDate(monThis));           // Mon this week
dates.push(toIsoDate(addDays(monThis, 1))); // Tue this week

const snap = buildProgressSnapshot(dates, 3, 12, now);

let ok = true;
function check(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  if (!pass) ok = false;
  console.log(`${pass ? "✓" : "✗"} ${label}: ${actual} ${pass ? "" : `(expected ${expected})`}`);
}

check("totalClasses",      snap.totalClasses,      17);
check("currentWeekCount",  snap.currentWeekCount,  2);
check("currentWeek.hitGoal", snap.currentWeek.hitGoal, false);
check("streakWeeks",       snap.streakWeeks,       5);
check("longestStreak",     snap.longestStreakWeeks, 5);

const badges = evaluateEarnedBadges({
  totalClasses: snap.totalClasses,
  longestStreakWeeks: snap.longestStreakWeeks,
  currentBelt: "blue",
  beltHistory: ["white", "blue"],
});
const badgeKeys = badges.map((b) => b.key).sort();
console.log("badges earned:", badgeKeys.join(", "));
check("attendance_10 badge",  badgeKeys.includes("attendance_10"),  true);
check("belt_blue badge",       badgeKeys.includes("belt_blue"),       true);
check("belt_white NOT earned", badgeKeys.includes("belt_white"),     false);

const next = nextAttendanceMilestone(snap.totalClasses);
check("next milestone tier", next?.tier,       25);
check("next milestone rem",  next?.remaining,  8);

process.exit(ok ? 0 : 1);
