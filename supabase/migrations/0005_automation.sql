-- Automation rules + communications log

------------------------------------------------------------------------------
-- Enums
------------------------------------------------------------------------------

do $$ begin
  create type automation_rule_key as enum (
    'new_lead_welcome', 'no_show_follow_up', 're_engagement'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type comm_channel as enum ('email', 'sms');
exception when duplicate_object then null; end $$;

do $$ begin
  create type comm_status as enum (
    'queued', 'sent', 'delivered', 'failed', 'simulated'
  );
exception when duplicate_object then null; end $$;

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table if not exists public.automation_rules (
  id              uuid primary key default gen_random_uuid(),
  gym_id          uuid not null references public.gyms(id) on delete cascade,
  rule_key        automation_rule_key not null,
  enabled         boolean not null default false,
  channel_email   boolean not null default true,
  channel_sms     boolean not null default true,
  email_subject   text,
  email_body      text,
  sms_body        text,
  delay_minutes   integer not null default 0 check (delay_minutes >= 0),
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (gym_id, rule_key)
);

create index if not exists automation_rules_gym_idx on public.automation_rules (gym_id);

create table if not exists public.communications (
  id            uuid primary key default gen_random_uuid(),
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  rule_key      automation_rule_key,
  channel       comm_channel not null,
  status        comm_status not null default 'queued',
  recipient_id  uuid,           -- student or lead id, depending on context
  recipient_kind text,          -- 'student' | 'lead' | 'manual'
  to_address    text not null,  -- email or phone
  subject       text,
  body          text not null,
  provider_id   text,           -- e.g. Resend / Twilio message id
  error         text,
  created_at    timestamptz not null default now()
);

create index if not exists communications_gym_idx on public.communications (gym_id, created_at desc);
create index if not exists communications_rule_idx on public.communications (gym_id, rule_key, created_at desc);
