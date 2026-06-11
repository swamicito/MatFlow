-- MatFlow billing extras
--
-- Adds Stripe-tracking columns and a quarterly billing interval.
--
-- NOTE: Postgres prohibits `ALTER TYPE ... ADD VALUE` inside a transaction
-- block in older versions. If your editor wraps statements in a transaction
-- and this fails, run line ONE (the enum addition) on its own, then the rest.

alter type membership_interval add value if not exists 'quarter';

alter table public.membership_plans
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id   text;

alter table public.memberships
  add column if not exists stripe_price_id      text,
  add column if not exists current_period_end   timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false;

create index if not exists memberships_status_idx
  on public.memberships(status);
create index if not exists memberships_stripe_sub_idx
  on public.memberships(stripe_subscription_id);
