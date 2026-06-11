-- Gamification: weekly goals, badges, challenges, leaderboards.

------------------------------------------------------------------------------
-- student_goals: one row per student, current weekly target.
------------------------------------------------------------------------------
create table if not exists public.student_goals (
  student_id      uuid primary key references public.students(id) on delete cascade,
  weekly_target   integer not null default 3 check (weekly_target between 1 and 7),
  updated_at      timestamptz not null default now()
);

------------------------------------------------------------------------------
-- student_badges: one row per (student, badge_key). badge_key is free-form
-- text so we can add new badges without altering enums.
------------------------------------------------------------------------------
create table if not exists public.student_badges (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references public.students(id) on delete cascade,
  badge_key    text not null,
  earned_at    timestamptz not null default now(),
  meta         jsonb not null default '{}'::jsonb,
  unique (student_id, badge_key)
);

create index if not exists student_badges_student_idx
  on public.student_badges (student_id, earned_at desc);

------------------------------------------------------------------------------
-- challenges: gym-scoped, time-limited goals.
------------------------------------------------------------------------------
create table if not exists public.challenges (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  key             text not null,                    -- stable key (e.g. "no_gi_november")
  title           text not null,
  description     text,
  target_classes  integer not null default 12 check (target_classes > 0),
  start_date      date not null,
  end_date        date not null,
  enabled         boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (gym_id, key)
);

create index if not exists challenges_gym_idx
  on public.challenges (gym_id, start_date desc);

------------------------------------------------------------------------------
-- challenge_participants: which students joined which challenges.
------------------------------------------------------------------------------
create table if not exists public.challenge_participants (
  id             uuid primary key default gen_random_uuid(),
  challenge_id   uuid not null references public.challenges(id) on delete cascade,
  student_id     uuid not null references public.students(id) on delete cascade,
  joined_at      timestamptz not null default now(),
  completed_at   timestamptz,
  unique (challenge_id, student_id)
);

create index if not exists challenge_participants_challenge_idx
  on public.challenge_participants (challenge_id);
create index if not exists challenge_participants_student_idx
  on public.challenge_participants (student_id);

------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------
alter table public.student_goals          enable row level security;
alter table public.student_badges         enable row level security;
alter table public.challenges             enable row level security;
alter table public.challenge_participants enable row level security;

-- Same-gym read/write pattern used elsewhere in the schema. We rely on the
-- service-role client (admin) for server actions, so policies are permissive
-- for authenticated users in the same gym.

do $$ begin
  create policy student_goals_same_gym
    on public.student_goals for all
    using (
      exists (
        select 1 from public.students s
        where s.id = student_goals.student_id
          and s.gym_id = public.user_gym_id()
      )
    )
    with check (
      exists (
        select 1 from public.students s
        where s.id = student_goals.student_id
          and s.gym_id = public.user_gym_id()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy student_badges_same_gym
    on public.student_badges for all
    using (
      exists (
        select 1 from public.students s
        where s.id = student_badges.student_id
          and s.gym_id = public.user_gym_id()
      )
    )
    with check (
      exists (
        select 1 from public.students s
        where s.id = student_badges.student_id
          and s.gym_id = public.user_gym_id()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy challenges_same_gym
    on public.challenges for all
    using (gym_id = public.user_gym_id())
    with check (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy challenge_participants_same_gym
    on public.challenge_participants for all
    using (
      exists (
        select 1 from public.challenges c
        where c.id = challenge_participants.challenge_id
          and c.gym_id = public.user_gym_id()
      )
    )
    with check (
      exists (
        select 1 from public.challenges c
        where c.id = challenge_participants.challenge_id
          and c.gym_id = public.user_gym_id()
      )
    );
exception when duplicate_object then null; end $$;
