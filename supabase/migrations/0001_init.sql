-- MatFlow initial schema
-- Run on a fresh Supabase project (cloud or local).
-- All tables are gym-scoped via Row Level Security so a user can only access
-- the data belonging to the gym referenced by their profile.

------------------------------------------------------------------------------
-- Extensions
------------------------------------------------------------------------------
create extension if not exists "pgcrypto";

------------------------------------------------------------------------------
-- Enums
------------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('owner', 'admin', 'instructor', 'front_desk');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum (
    'new', 'contacted', 'trial_scheduled', 'trial_completed', 'converted', 'lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type student_status as enum ('active', 'paused', 'cancelled', 'trial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type belt_rank as enum (
    'white', 'gray', 'yellow', 'orange', 'green', 'blue', 'purple', 'brown', 'black'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_interval as enum ('week', 'month', 'year');
exception when duplicate_object then null; end $$;

do $$ begin
  create type membership_status as enum (
    'active', 'past_due', 'canceled', 'trialing', 'paused'
  );
exception when duplicate_object then null; end $$;

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table if not exists public.gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'owner',
  phone       text,
  gym_id      uuid references public.gyms(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.family_accounts (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  parent_name   text not null,
  parent_email  text,
  parent_phone  text,
  created_at    timestamptz not null default now()
);

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  source      text,
  status      lead_status not null default 'new',
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.students (
  id                          uuid primary key default gen_random_uuid(),
  gym_id                      uuid not null references public.gyms(id) on delete cascade,
  lead_id                     uuid references public.leads(id) on delete set null,
  full_name                   text not null,
  email                       text,
  phone                       text,
  date_of_birth               date,
  belt_rank                   belt_rank not null default 'white',
  is_adult                    boolean not null default true,
  family_account_id           uuid references public.family_accounts(id) on delete set null,
  notes                       text,
  join_date                   date not null default current_date,
  status                      student_status not null default 'active',
  stripe_customer_id          text,
  custom_monthly_price_cents  integer,  -- grandfathered/override pricing
  created_at                  timestamptz not null default now()
);

create table if not exists public.membership_plans (
  id           uuid primary key default gen_random_uuid(),
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  name         text not null,
  price_cents  integer not null check (price_cents >= 0),
  interval     membership_interval not null default 'month',
  description  text,
  created_at   timestamptz not null default now()
);

create table if not exists public.memberships (
  id                      uuid primary key default gen_random_uuid(),
  student_id              uuid not null references public.students(id) on delete cascade,
  plan_id                 uuid not null references public.membership_plans(id) on delete restrict,
  custom_price_cents      integer,  -- per-membership override for grandfathered pricing
  stripe_subscription_id  text,
  status                  membership_status not null default 'active',
  start_date              date not null default current_date,
  created_at              timestamptz not null default now()
);

create table if not exists public.attendance (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references public.students(id) on delete cascade,
  class_date     date not null,
  class_type     text,
  checked_in_at  timestamptz not null default now()
);

create table if not exists public.belt_progress (
  id                   uuid primary key default gen_random_uuid(),
  student_id           uuid not null unique references public.students(id) on delete cascade,
  current_belt         belt_rank not null default 'white',
  stripes              smallint not null default 0 check (stripes between 0 and 4),
  skills_completed     jsonb not null default '[]'::jsonb,
  progress_percentage  numeric(5,2) not null default 0 check (progress_percentage between 0 and 100),
  updated_at           timestamptz not null default now()
);

create table if not exists public.waivers (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references public.students(id) on delete cascade,
  signed_at       timestamptz not null default now(),
  signature_data  text,
  pdf_url         text
);

------------------------------------------------------------------------------
-- Indexes
------------------------------------------------------------------------------
create index if not exists profiles_gym_id_idx          on public.profiles(gym_id);
create index if not exists leads_gym_id_idx             on public.leads(gym_id);
create index if not exists leads_status_idx             on public.leads(gym_id, status);
create index if not exists students_gym_id_idx          on public.students(gym_id);
create index if not exists students_lead_id_idx         on public.students(lead_id);
create index if not exists students_family_idx          on public.students(family_account_id);
create index if not exists membership_plans_gym_id_idx  on public.membership_plans(gym_id);
create index if not exists memberships_student_idx      on public.memberships(student_id);
create index if not exists memberships_plan_idx         on public.memberships(plan_id);
create index if not exists attendance_student_date_idx  on public.attendance(student_id, class_date);
create index if not exists family_accounts_gym_id_idx   on public.family_accounts(gym_id);
create index if not exists waivers_student_idx          on public.waivers(student_id);

------------------------------------------------------------------------------
-- Helper: current user's gym_id
------------------------------------------------------------------------------
create or replace function public.user_gym_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

grant execute on function public.user_gym_id() to authenticated;

------------------------------------------------------------------------------
-- Profile auto-provisioning on signup
------------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------------------------
alter table public.gyms             enable row level security;
alter table public.profiles         enable row level security;
alter table public.family_accounts  enable row level security;
alter table public.leads            enable row level security;
alter table public.students         enable row level security;
alter table public.membership_plans enable row level security;
alter table public.memberships      enable row level security;
alter table public.attendance       enable row level security;
alter table public.belt_progress    enable row level security;
alter table public.waivers          enable row level security;

-- gyms: a user can read/update only their own gym
drop policy if exists "gyms_select_own" on public.gyms;
create policy "gyms_select_own" on public.gyms
  for select to authenticated
  using (id = public.user_gym_id());

drop policy if exists "gyms_update_own" on public.gyms;
create policy "gyms_update_own" on public.gyms
  for update to authenticated
  using (id = public.user_gym_id())
  with check (id = public.user_gym_id());

drop policy if exists "gyms_insert_self" on public.gyms;
create policy "gyms_insert_self" on public.gyms
  for insert to authenticated
  with check (true);  -- onboarding: the first gym a user creates; tighten later

-- profiles: a user can read profiles in their gym and edit their own row
drop policy if exists "profiles_select_same_gym" on public.profiles;
create policy "profiles_select_same_gym" on public.profiles
  for select to authenticated
  using (id = auth.uid() or gym_id = public.user_gym_id());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Generic gym-scoped policy generator pattern via per-table policies
-- leads
drop policy if exists "leads_rw" on public.leads;
create policy "leads_rw" on public.leads
  for all to authenticated
  using (gym_id = public.user_gym_id())
  with check (gym_id = public.user_gym_id());

-- students
drop policy if exists "students_rw" on public.students;
create policy "students_rw" on public.students
  for all to authenticated
  using (gym_id = public.user_gym_id())
  with check (gym_id = public.user_gym_id());

-- family_accounts
drop policy if exists "family_accounts_rw" on public.family_accounts;
create policy "family_accounts_rw" on public.family_accounts
  for all to authenticated
  using (gym_id = public.user_gym_id())
  with check (gym_id = public.user_gym_id());

-- membership_plans
drop policy if exists "membership_plans_rw" on public.membership_plans;
create policy "membership_plans_rw" on public.membership_plans
  for all to authenticated
  using (gym_id = public.user_gym_id())
  with check (gym_id = public.user_gym_id());

-- memberships: scoped through the parent student
drop policy if exists "memberships_rw" on public.memberships;
create policy "memberships_rw" on public.memberships
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = memberships.student_id
        and s.gym_id = public.user_gym_id()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = memberships.student_id
        and s.gym_id = public.user_gym_id()
    )
  );

-- attendance
drop policy if exists "attendance_rw" on public.attendance;
create policy "attendance_rw" on public.attendance
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id
        and s.gym_id = public.user_gym_id()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = attendance.student_id
        and s.gym_id = public.user_gym_id()
    )
  );

-- belt_progress
drop policy if exists "belt_progress_rw" on public.belt_progress;
create policy "belt_progress_rw" on public.belt_progress
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = belt_progress.student_id
        and s.gym_id = public.user_gym_id()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = belt_progress.student_id
        and s.gym_id = public.user_gym_id()
    )
  );

-- waivers
drop policy if exists "waivers_rw" on public.waivers;
create policy "waivers_rw" on public.waivers
  for all to authenticated
  using (
    exists (
      select 1 from public.students s
      where s.id = waivers.student_id
        and s.gym_id = public.user_gym_id()
    )
  )
  with check (
    exists (
      select 1 from public.students s
      where s.id = waivers.student_id
        and s.gym_id = public.user_gym_id()
    )
  );
