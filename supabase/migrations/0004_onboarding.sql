-- Onboarding wizard support
-- Adds gym profile fields collected on Step 1 + an onboarding completion flag
-- so we can route first-time users to /onboarding and skip it on later visits.

alter table public.gyms
  add column if not exists address              text,
  add column if not exists phone                text,
  add column if not exists timezone             text not null default 'America/New_York',
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists webhook_last_test_at timestamptz;

-- Backfill: gyms that already have memberships, students, or families are
-- almost certainly past onboarding. Mark them complete so existing users
-- don't get bounced into the wizard.
update public.gyms g
set onboarding_completed = true
where exists (
  select 1 from public.students s where s.gym_id = g.id
);
