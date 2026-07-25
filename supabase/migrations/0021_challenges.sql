-- MatFlow Passport Challenges: time-bound goals that reward passport points on completion.
--
-- Named passport_challenges (not challenges) to avoid conflict with the
-- student-centric challenges table added in 0007_gamification.sql.
--
-- challenge_type drives how progress is measured:
--   "class_count"   — incremented once per checkInStudent() call
--   "streak"        — derived from user_passport.current_streak at evaluation
--   "points_earned" — derived from user_passport.points at evaluation

------------------------------------------------------------------------------
-- passport_challenges: gym-scoped challenge definitions
------------------------------------------------------------------------------
create table if not exists public.passport_challenges (
  id              uuid        primary key default gen_random_uuid(),
  gym_id          uuid        not null references public.gyms(id) on delete cascade,
  title           text        not null,
  description     text,
  challenge_type  text        not null
                              check (challenge_type in ('class_count', 'streak', 'points_earned')),
  goal_value      integer     not null check (goal_value > 0),
  points_reward   integer     not null default 50 check (points_reward >= 0),
  start_date      date        not null,
  end_date        date        not null,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  check (end_date > start_date)
);

create index if not exists passport_challenges_gym_active_idx
  on public.passport_challenges (gym_id, is_active, end_date desc);

------------------------------------------------------------------------------
-- user_challenge_progress: one row per (user, challenge)
--
-- current_progress is the incremental counter for class_count challenges.
-- For streak and points_earned the value is derived from user_passport at
-- evaluation time; current_progress is still updated for UI consistency.
-- completed_at is null until the challenge is won.
------------------------------------------------------------------------------
create table if not exists public.user_challenge_progress (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users(id) on delete cascade,
  gym_id           uuid        not null references public.gyms(id) on delete cascade,
  challenge_id     uuid        not null references public.passport_challenges(id) on delete cascade,
  current_progress integer     not null default 0 check (current_progress >= 0),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, challenge_id)
);

create index if not exists user_challenge_progress_user_gym_idx
  on public.user_challenge_progress (user_id, gym_id);

create index if not exists user_challenge_progress_challenge_idx
  on public.user_challenge_progress (challenge_id);

------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------
alter table public.passport_challenges     enable row level security;
alter table public.user_challenge_progress enable row level security;

-- passport_challenges: any authenticated gym member can read; service role writes
do $$ begin
  create policy passport_challenges_gym_read
    on public.passport_challenges for select
    using (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

-- user_challenge_progress: owner can read/write their own rows
do $$ begin
  create policy user_challenge_progress_own
    on public.user_challenge_progress for all
    using   (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- gym staff can read all progress rows for their gym
do $$ begin
  create policy user_challenge_progress_gym_read
    on public.user_challenge_progress for select
    using (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

------------------------------------------------------------------------------
-- Example seed rows (commented out — requires a real gym_id at runtime).
-- Run after setting up a gym:
--
-- insert into public.passport_challenges
--   (gym_id, title, description, challenge_type, goal_value, points_reward,
--    start_date, end_date)
-- values
--   ('<gym_id>', 'August Attendance',  'Attend 8 classes this month.',           'class_count',   8,  100, '2025-08-01', '2025-08-31'),
--   ('<gym_id>', 'Streak Week',        'Maintain a 7-day check-in streak.',      'streak',        7,  75,  '2025-08-01', '2025-08-31'),
--   ('<gym_id>', 'Point Surge',        'Earn 150 points in one week.',           'points_earned', 150, 50, '2025-08-04', '2025-08-10'),
--   ('<gym_id>', 'Consistency Trophy', 'Attend 20 classes this quarter.',        'class_count',   20, 200, '2025-07-01', '2025-09-30');
------------------------------------------------------------------------------
