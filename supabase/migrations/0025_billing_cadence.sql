-------------------------------------------------------------------------------
-- 0025_billing_cadence.sql
-- Gym-level student billing preferences: anniversary vs calendar billing.
-------------------------------------------------------------------------------

alter table public.gyms
  add column if not exists billing_cadence    text not null default 'anniversary'
    check (billing_cadence in ('anniversary', 'calendar')),
  add column if not exists billing_anchor_day smallint not null default 1
    check (billing_anchor_day between 1 and 28);

comment on column public.gyms.billing_cadence is
  'anniversary = bill each student on their join date; calendar = bill everyone on billing_anchor_day';
comment on column public.gyms.billing_anchor_day is
  'Day of month (1-28) students are billed when billing_cadence = calendar';
