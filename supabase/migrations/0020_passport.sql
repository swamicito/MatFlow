-- MatFlow Passport: points, levels, streaks, and badges for authenticated users.
-- Complements the existing student-centric gamification (0007) with an auth-user
-- layer so gym owners / staff can eventually have passports too.

------------------------------------------------------------------------------
-- user_passport: one row per (auth_user, gym).
-- The level column is a derived cache — always recomputed as floor(points/100)+1.
------------------------------------------------------------------------------
create table if not exists public.user_passport (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id)  on delete cascade,
  gym_id            uuid        not null references public.gyms(id) on delete cascade,
  points            integer     not null default 0   check (points >= 0),
  level             integer     not null default 1   check (level  >= 1),
  current_streak    integer     not null default 0   check (current_streak >= 0),
  longest_streak    integer     not null default 0   check (longest_streak >= 0),
  last_checkin_date date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, gym_id)
);

create index if not exists user_passport_gym_points_idx
  on public.user_passport (gym_id, points desc);   -- leaderboard queries

create index if not exists user_passport_user_idx
  on public.user_passport (user_id);

-- Shared updated_at trigger function (idempotent).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger user_passport_updated_at
    before update on public.user_passport
    for each row execute function public.touch_updated_at();
exception when duplicate_object then null; end $$;

------------------------------------------------------------------------------
-- badges: platform-level definitions (not gym-scoped).
-- criteria_type drives the check in checkAndAwardBadges():
--   "points"           — passport.points >= criteria_value
--   "streak"           — current or longest streak >= criteria_value
--   "classes_attended" — total attendance count  >= criteria_value
--   "belt_rank"        — student belt rank ordinal >= criteria_value
------------------------------------------------------------------------------
create table if not exists public.badges (
  id             uuid        primary key default gen_random_uuid(),
  slug           text        not null unique,
  name           text        not null,
  description    text,
  icon           text,       -- emoji or icon key used by the UI
  criteria_type  text        not null
                             check (criteria_type in (
                               'points', 'streak', 'classes_attended', 'belt_rank'
                             )),
  criteria_value integer     not null default 0 check (criteria_value >= 0),
  created_at     timestamptz not null default now()
);

-- Seed starter badges.  ON CONFLICT DO NOTHING makes this re-runnable.
insert into public.badges
  (slug, name, description, icon, criteria_type, criteria_value)
values
  -- classes_attended milestones
  ('first_step',    'First Step',    'Attend your very first class.',       '🥋', 'classes_attended', 1),
  ('ten_classes',   'Ten Classes',   'Complete 10 classes.',                '🎯', 'classes_attended', 10),
  ('fifty_classes', 'Fifty Classes', 'Complete 50 classes.',                '💪', 'classes_attended', 50),
  ('century_mat',   'Century',       'Complete 100 classes.',               '🏅', 'classes_attended', 100),
  -- streak milestones
  ('on_a_roll',     'On a Roll',     'Maintain a 3-day check-in streak.',   '🔥', 'streak',           3),
  ('consistent',    'Consistent',    'Maintain a 7-day check-in streak.',   '⚡', 'streak',           7),
  ('dedicated',     'Dedicated',     'Maintain a 30-day check-in streak.',  '🔱', 'streak',           30),
  -- points milestones
  ('first_hundred', 'First Hundred', 'Earn your first 100 points.',         '💯', 'points',           100),
  ('point_leader',  'Point Leader',  'Earn 500 points.',                    '🏆', 'points',           500),
  ('elite',         'Elite',         'Earn 1,000 points.',                  '⭐', 'points',           1000)
on conflict (slug) do nothing;

------------------------------------------------------------------------------
-- user_badges: which badges a user has earned per gym.
------------------------------------------------------------------------------
create table if not exists public.user_badges (
  id        uuid        primary key default gen_random_uuid(),
  user_id   uuid        not null references auth.users(id)    on delete cascade,
  gym_id    uuid        not null references public.gyms(id)   on delete cascade,
  badge_id  uuid        not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, gym_id, badge_id)
);

create index if not exists user_badges_user_gym_idx
  on public.user_badges (user_id, gym_id, earned_at desc);

create index if not exists user_badges_gym_idx
  on public.user_badges (gym_id);

------------------------------------------------------------------------------
-- point_ledger: immutable audit trail for every point transaction.
-- points can be negative for future deduction use-cases.
------------------------------------------------------------------------------
create table if not exists public.point_ledger (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id)  on delete cascade,
  gym_id     uuid        not null references public.gyms(id) on delete cascade,
  points     integer     not null,
  reason     text        not null,   -- e.g. "class_checkin", "challenge_complete", "manual_award"
  created_at timestamptz not null default now()
);

create index if not exists point_ledger_user_gym_idx
  on public.point_ledger (user_id, gym_id, created_at desc);

------------------------------------------------------------------------------
-- RLS
-- All server actions use the service-role admin client, so these policies
-- exist primarily for direct Supabase client calls (student portal).
------------------------------------------------------------------------------
alter table public.user_passport enable row level security;
alter table public.badges        enable row level security;
alter table public.user_badges   enable row level security;
alter table public.point_ledger  enable row level security;

-- user_passport: owner can read/write their own row; gym staff can read all.
do $$ begin
  create policy user_passport_own
    on public.user_passport for all
    using   (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy user_passport_gym_read
    on public.user_passport for select
    using (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

-- badges: any authenticated user can read; only service role writes.
do $$ begin
  create policy badges_read
    on public.badges for select
    using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- user_badges: owner can read their own; gym staff can read their gym's.
do $$ begin
  create policy user_badges_own
    on public.user_badges for all
    using   (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy user_badges_gym_read
    on public.user_badges for select
    using (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

-- point_ledger: owner can read their own history; gym staff can read their gym's.
do $$ begin
  create policy point_ledger_own
    on public.point_ledger for select
    using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy point_ledger_gym_read
    on public.point_ledger for select
    using (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;
