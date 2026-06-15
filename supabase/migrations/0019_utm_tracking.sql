-- 0019_utm_tracking.sql
-- Add UTM tracking columns to leads and students.
-- leads already has a `source` column from the init migration.
-- students gets source + all UTM fields so the origin is preserved
-- even after a lead is converted.

-- ── leads: add UTM columns ─────────────────────────────────────────────────
alter table public.leads
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term     text,
  add column if not exists utm_content  text;

-- ── students: add source + UTM columns ────────────────────────────────────
alter table public.students
  add column if not exists source       text,
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists utm_term     text,
  add column if not exists utm_content  text;
