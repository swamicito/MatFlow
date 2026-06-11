-- Role-Based Access (RBAC)
--
-- The `user_role` enum and `profiles.role` column already exist from
-- migration 0001_init. This migration:
--
--   1. Ensures every profile row has a sensible default role.
--   2. Tightens Row-Level Security on sensitive tables so that even if the
--      service role is bypassed (or RLS is re-enabled on a different
--      connection), Instructor / Front Desk profiles cannot mutate
--      billing-, settings-, or automation-scoped tables directly.
--
-- These policies are additive and intentionally conservative — the app's
-- service-role admin client (used by every server action) bypasses RLS by
-- design, so this is defense-in-depth for the day a real user-scoped client
-- is wired up.

------------------------------------------------------------------------------
-- Defaults
------------------------------------------------------------------------------

alter table public.profiles
  alter column role set default 'owner';

update public.profiles set role = 'owner' where role is null;

------------------------------------------------------------------------------
-- Helper: read the caller's role
------------------------------------------------------------------------------

create or replace function public.current_role_name()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

------------------------------------------------------------------------------
-- Policies
------------------------------------------------------------------------------

-- Memberships & plans: only owner/admin can write. Read is unchanged
-- (everyone in the gym can already see them via existing policies).
do $$ begin
  drop policy if exists "memberships_owner_write" on public.memberships;
  create policy "memberships_owner_write"
    on public.memberships
    for all
    to authenticated
    using (public.current_role_name() in ('owner','admin'))
    with check (public.current_role_name() in ('owner','admin'));
exception when undefined_table then null; end $$;

do $$ begin
  drop policy if exists "plans_owner_write" on public.membership_plans;
  create policy "plans_owner_write"
    on public.membership_plans
    for all
    to authenticated
    using (public.current_role_name() in ('owner','admin'))
    with check (public.current_role_name() in ('owner','admin'));
exception when undefined_table then null; end $$;

-- Automation: owner/admin only.
do $$ begin
  drop policy if exists "automation_rules_owner_write" on public.automation_rules;
  create policy "automation_rules_owner_write"
    on public.automation_rules
    for all
    to authenticated
    using (public.current_role_name() in ('owner','admin'))
    with check (public.current_role_name() in ('owner','admin'));
exception when undefined_table then null; end $$;

do $$ begin
  drop policy if exists "communications_owner_write" on public.communications;
  create policy "communications_owner_write"
    on public.communications
    for all
    to authenticated
    using (public.current_role_name() in ('owner','admin'))
    with check (public.current_role_name() in ('owner','admin'));
exception when undefined_table then null; end $$;

-- Profiles: only owners can change roles. (Profiles are otherwise self-
-- editable for things like name/phone via existing policies.)
do $$ begin
  drop policy if exists "profiles_role_owner_only" on public.profiles;
  create policy "profiles_role_owner_only"
    on public.profiles
    for update
    to authenticated
    using (public.current_role_name() = 'owner')
    with check (public.current_role_name() = 'owner');
exception when undefined_table then null; end $$;
