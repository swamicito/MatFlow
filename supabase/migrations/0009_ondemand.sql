-- On-Demand Instructionals: videos, purchases, watch progress.

------------------------------------------------------------------------------
-- instructionals: the video catalogue
------------------------------------------------------------------------------
create table if not exists public.instructionals (
  id                  uuid primary key default gen_random_uuid(),
  gym_id              uuid not null references public.gyms(id) on delete cascade,
  coach_id            uuid references auth.users(id) on delete set null,
  title               text not null,
  description         text,
  category            text not null default 'technique'
                        check (category in (
                          'technique','full_class','belt_specific',
                          'competition_prep','conditioning','mindset'
                        )),
  price_cents         integer not null default 0 check (price_cents >= 0),
  duration_seconds    integer check (duration_seconds > 0),
  video_url           text not null,
  thumbnail_url       text,
  visibility          text not null default 'gym_only'
                        check (visibility in ('public','gym_only')),
  is_free             boolean not null default false,
  stripe_product_id   text,
  stripe_price_id     text,
  sort_order          integer not null default 0,
  published_at        timestamptz,
  created_at          timestamptz not null default now()
);

create index if not exists instructionals_gym_idx
  on public.instructionals (gym_id, sort_order, created_at);

------------------------------------------------------------------------------
-- instructional_purchases: access grants
------------------------------------------------------------------------------
create table if not exists public.instructional_purchases (
  id                          uuid primary key default gen_random_uuid(),
  gym_id                      uuid not null references public.gyms(id) on delete cascade,
  student_id                  uuid not null references public.students(id) on delete cascade,
  instructional_id            uuid not null references public.instructionals(id) on delete cascade,
  amount_cents                integer not null check (amount_cents >= 0),
  status                      text not null default 'pending'
                                check (status in ('pending','paid','free','refunded')),
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text,
  created_at                  timestamptz not null default now(),
  unique (student_id, instructional_id)
);

create index if not exists instructional_purchases_student_idx
  on public.instructional_purchases (student_id);
create index if not exists instructional_purchases_gym_idx
  on public.instructional_purchases (gym_id, created_at desc);
create index if not exists instructional_purchases_session_idx
  on public.instructional_purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

------------------------------------------------------------------------------
-- watch_progress: per-student per-video playback state
------------------------------------------------------------------------------
create table if not exists public.watch_progress (
  student_id          uuid not null references public.students(id) on delete cascade,
  instructional_id    uuid not null references public.instructionals(id) on delete cascade,
  position_seconds    integer not null default 0,
  completed_pct       integer not null default 0 check (completed_pct between 0 and 100),
  completed           boolean not null default false,
  last_watched_at     timestamptz not null default now(),
  primary key (student_id, instructional_id)
);

------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------
alter table public.instructionals           enable row level security;
alter table public.instructional_purchases  enable row level security;
alter table public.watch_progress           enable row level security;

do $$ begin
  create policy instructionals_same_gym on public.instructionals for all
    using (gym_id = public.user_gym_id())
    with check (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy instructional_purchases_same_gym on public.instructional_purchases for all
    using (gym_id = public.user_gym_id())
    with check (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy watch_progress_same_gym on public.watch_progress for all
    using (
      exists (
        select 1 from public.students s
        where s.id = watch_progress.student_id
          and s.gym_id = public.user_gym_id()
      )
    )
    with check (
      exists (
        select 1 from public.students s
        where s.id = watch_progress.student_id
          and s.gym_id = public.user_gym_id()
      )
    );
exception when duplicate_object then null; end $$;
