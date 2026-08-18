-- Platform subscription lifecycle + access gating
--
-- Tracks the gym's subscription TO MatFlow (platform billing) directly on the
-- gyms row, and adds a billing_exempt flag for complimentary gyms that must
-- never be locked out.
--
-- Status values: trialing | active | past_due | canceled | unpaid
-- (NULL = gym predates platform billing — treated as full access.)

alter table public.gyms
  add column if not exists platform_subscription_status    text,
  add column if not exists platform_stripe_subscription_id text,
  add column if not exists platform_stripe_customer_id     text,
  add column if not exists platform_current_period_end     timestamptz,
  add column if not exists platform_past_due_since         timestamptz,
  add column if not exists billing_exempt                  boolean not null default false;

create index if not exists gyms_platform_sub_idx
  on public.gyms(platform_stripe_subscription_id);

-- Sanity check constraint (nullable so legacy gyms are unaffected).
alter table public.gyms
  drop constraint if exists gyms_platform_status_check;
alter table public.gyms
  add constraint gyms_platform_status_check
  check (platform_subscription_status is null or platform_subscription_status in
    ('trialing', 'active', 'past_due', 'canceled', 'unpaid'));

-- Complimentary gyms — never gated.
update public.gyms set billing_exempt = true
where slug in ('method-jiu-jitsu-2');
