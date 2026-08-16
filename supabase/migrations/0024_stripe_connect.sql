-------------------------------------------------------------------------------
-- 0024_stripe_connect.sql
-- Stripe Connect (Express) fields on gyms. Stores only the connected account
-- ID and capability flags — never raw keys.
-------------------------------------------------------------------------------

alter table public.gyms
  add column if not exists stripe_account_id         text,
  add column if not exists stripe_details_submitted  boolean not null default false,
  add column if not exists stripe_charges_enabled    boolean not null default false,
  add column if not exists stripe_payouts_enabled    boolean not null default false,
  add column if not exists stripe_connected_at       timestamptz;

create unique index if not exists gyms_stripe_account_id_key
  on public.gyms (stripe_account_id)
  where stripe_account_id is not null;
