-- MatFlow: extend the existing family_accounts + waivers tables with the
-- columns the Family Accounts and Digital Waivers UI need.
--
-- Tables already exist from 0001_init.sql; this migration is purely additive.

------------------------------------------------------------------------------
-- family_accounts: add head, shared billing flag, notes
------------------------------------------------------------------------------
alter table public.family_accounts
  add column if not exists head_student_id uuid
    references public.students(id) on delete set null,
  add column if not exists shared_billing  boolean not null default false,
  add column if not exists notes           text;

------------------------------------------------------------------------------
-- waivers: add waiver type + signer name; ensure signature_data is required
------------------------------------------------------------------------------
alter table public.waivers
  add column if not exists waiver_type    text not null default 'liability_release',
  add column if not exists signed_by_name text,
  add column if not exists ip_address     text;

create index if not exists waivers_signed_at_idx on public.waivers(signed_at desc);
