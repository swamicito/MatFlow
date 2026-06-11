-- Student Self-Service Portal
-- Maps Supabase Auth users → student records, adds portal-scoped RLS read policies.

------------------------------------------------------------------------------
-- student_auth: one row per student who has activated their portal account.
-- Populated on first magic-link sign-in via /auth/callback.
------------------------------------------------------------------------------
create table if not exists public.student_auth (
  auth_user_id  uuid primary key references auth.users(id) on delete cascade,
  student_id    uuid not null unique references public.students(id) on delete cascade,
  created_at    timestamptz not null default now()
);

alter table public.student_auth enable row level security;

-- A student can only see/update their own mapping row
do $$ begin
  create policy student_auth_self on public.student_auth
    for all using (auth_user_id = auth.uid())
    with check (auth_user_id = auth.uid());
exception when duplicate_object then null; end $$;

------------------------------------------------------------------------------
-- current_student_id(): returns the students.id for the logged-in portal user.
-- Used in portal RLS policies below.
------------------------------------------------------------------------------
create or replace function public.current_student_id()
returns uuid language sql stable security definer as $$
  select student_id
  from   public.student_auth
  where  auth_user_id = auth.uid()
$$;

------------------------------------------------------------------------------
-- Portal read policies — students may SELECT only their own rows.
-- We add these alongside the existing staff policies; service-role bypasses all.
------------------------------------------------------------------------------

-- students: a student can read their own row
do $$ begin
  create policy students_portal_self on public.students
    for select using (id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- attendance
do $$ begin
  create policy attendance_portal_self on public.attendance
    for select using (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- belt_progress
do $$ begin
  create policy belt_progress_portal_self on public.belt_progress
    for select using (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- memberships
do $$ begin
  create policy memberships_portal_self on public.memberships
    for select using (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- student_credits
do $$ begin
  create policy student_credits_portal_self on public.student_credits
    for select using (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- student_goals
do $$ begin
  create policy student_goals_portal_self on public.student_goals
    for select using (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- student_badges
do $$ begin
  create policy student_badges_portal_self on public.student_badges
    for select using (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- purchases
do $$ begin
  create policy purchases_portal_self on public.purchases
    for select using (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- instructional_purchases
do $$ begin
  create policy instructional_purchases_portal_self on public.instructional_purchases
    for select using (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- watch_progress (read + write so students can save resume position)
do $$ begin
  create policy watch_progress_portal_self on public.watch_progress
    for all using (student_id = public.current_student_id())
    with check (student_id = public.current_student_id());
exception when duplicate_object then null; end $$;

-- instructionals: portal students can view published content they own
do $$ begin
  create policy instructionals_portal_purchased on public.instructionals
    for select using (
      is_free = true
      or exists (
        select 1 from public.instructional_purchases ip
        where ip.instructional_id = instructionals.id
          and ip.student_id = public.current_student_id()
          and ip.status = 'paid'
      )
    );
exception when duplicate_object then null; end $$;
