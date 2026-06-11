-- Conversion Triggers: 4th class nudge + 10-visit review request

------------------------------------------------------------------------------
-- Extend automation_rule_key enum
------------------------------------------------------------------------------
do $$ begin
  alter type automation_rule_key add value if not exists 'fourth_class';
  alter type automation_rule_key add value if not exists 'ten_visits';
exception when duplicate_object then null; end $$;

------------------------------------------------------------------------------
-- gyms.google_review_url
------------------------------------------------------------------------------
alter table public.gyms
  add column if not exists google_review_url text;

------------------------------------------------------------------------------
-- automation_triggers: idempotent trigger log
------------------------------------------------------------------------------
create table if not exists public.automation_triggers (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  student_id    uuid not null references public.students(id) on delete cascade,
  trigger_type  text not null,  -- 'fourth_class' | 'ten_visits'
  triggered_at  timestamptz not null default now(),
  sent          boolean not null default false,
  unique (student_id, trigger_type)
);

create index if not exists automation_triggers_student_idx on public.automation_triggers (student_id);
create index if not exists automation_triggers_gym_idx on public.automation_triggers (gym_id, triggered_at desc);

-- RLS: students cannot access this table; only service role / admin client
alter table public.automation_triggers enable row level security;
