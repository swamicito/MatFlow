-- Multi-Tenancy: user_gyms junction table
--
-- Allows a single user to own or manage multiple gyms.
-- The active gym the user is currently viewing is tracked in the app layer
-- via the `mf-gym-id` cookie (set by /api/gym).
--
-- `user_gym_id()` is updated to accept an optional session variable
-- `app.current_gym_id` so that server-side code can set it explicitly.
-- When that variable is not set it falls back to the profile's gym_id for
-- backwards compatibility.
--
-- The existing `profiles.gym_id` column is kept as the "default" / primary gym
-- for users who have only one gym.

------------------------------------------------------------------------------
-- user_gyms junction table
------------------------------------------------------------------------------

create table if not exists public.user_gyms (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  gym_id     uuid not null references public.gyms(id) on delete cascade,
  role       user_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (user_id, gym_id)
);

create index if not exists user_gyms_user_idx on public.user_gyms(user_id);
create index if not exists user_gyms_gym_idx  on public.user_gyms(gym_id);

alter table public.user_gyms enable row level security;

drop policy if exists "user_gyms_self" on public.user_gyms;
create policy "user_gyms_self" on public.user_gyms
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

------------------------------------------------------------------------------
-- gym owner_user_id column (fast reverse lookup)
------------------------------------------------------------------------------

alter table public.gyms
  add column if not exists owner_user_id uuid references auth.users(id) on delete set null;

alter table public.gyms
  add column if not exists logo_url text;

alter table public.gyms
  add column if not exists contact_email text;

alter table public.gyms
  add column if not exists contact_phone text;

------------------------------------------------------------------------------
-- Updated user_gym_id() — respects app.current_gym_id session variable
------------------------------------------------------------------------------

create or replace function public.user_gym_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_gym_id uuid;
begin
  -- 1. Prefer an explicitly set session variable (set by server-side code)
  begin
    v_gym_id := current_setting('app.current_gym_id', true)::uuid;
    if v_gym_id is not null then
      -- Verify the user actually belongs to this gym
      if exists (
        select 1 from public.user_gyms
        where user_id = auth.uid() and gym_id = v_gym_id
      ) then
        return v_gym_id;
      end if;
      -- Also allow profile.gym_id as fallback ownership check
      if exists (
        select 1 from public.profiles
        where id = auth.uid() and gym_id = v_gym_id
      ) then
        return v_gym_id;
      end if;
    end if;
  exception when others then
    null; -- setting not present or not a valid uuid
  end;

  -- 2. Fall back to profiles.gym_id
  select gym_id into v_gym_id from public.profiles where id = auth.uid();
  return v_gym_id;
end;
$$;

grant execute on function public.user_gym_id() to authenticated;

------------------------------------------------------------------------------
-- Helper: list all gym_ids the current user can access
------------------------------------------------------------------------------

create or replace function public.user_gym_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  -- Gyms from the junction table
  select gym_id from public.user_gyms where user_id = auth.uid()
  union
  -- Primary gym from profiles (for users who pre-date user_gyms)
  select gym_id from public.profiles where id = auth.uid() and gym_id is not null
$$;

grant execute on function public.user_gym_ids() to authenticated;

------------------------------------------------------------------------------
-- gyms: allow a user to see ALL their gyms (not just the active one)
------------------------------------------------------------------------------

drop policy if exists "gyms_select_own" on public.gyms;
create policy "gyms_select_own" on public.gyms
  for select to authenticated
  using (id = any(select public.user_gym_ids()));

drop policy if exists "gyms_update_own" on public.gyms;
create policy "gyms_update_own" on public.gyms
  for update to authenticated
  using  (id = any(select public.user_gym_ids()))
  with check (id = any(select public.user_gym_ids()));

------------------------------------------------------------------------------
-- Backfill user_gyms for existing profiles that have a gym_id
------------------------------------------------------------------------------

insert into public.user_gyms (user_id, gym_id, role)
select p.id, p.gym_id, p.role
from   public.profiles p
where  p.gym_id is not null
on conflict (user_id, gym_id) do nothing;
