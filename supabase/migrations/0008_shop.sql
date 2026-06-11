-- Shop: products, purchases, student credits.

------------------------------------------------------------------------------
-- products: gym-scoped catalogue of one-time purchasable items.
------------------------------------------------------------------------------
create table if not exists public.products (
  id                    uuid primary key default gen_random_uuid(),
  gym_id                uuid not null references public.gyms(id) on delete cascade,
  name                  text not null,
  description           text,
  product_type          text not null
                          check (product_type in
                            ('drop_in','pack','private','gift_card','special')),
  price_cents           integer not null default 0 check (price_cents >= 0),
  original_price_cents  integer check (original_price_cents > 0),
  class_credits         integer not null default 1 check (class_credits >= 0),
  validity_days         integer check (validity_days > 0),   -- null = no expiry
  max_quantity          integer check (max_quantity > 0),    -- null = unlimited
  visible               boolean not null default true,
  special_start_date    date,
  special_end_date      date,
  stripe_product_id     text,
  stripe_price_id       text,
  sort_order            integer not null default 0,
  created_at            timestamptz not null default now()
);

create index if not exists products_gym_idx
  on public.products (gym_id, sort_order, created_at);

------------------------------------------------------------------------------
-- purchases: one row per transaction (pending → paid/failed/manual).
------------------------------------------------------------------------------
create table if not exists public.purchases (
  id                          uuid primary key default gen_random_uuid(),
  gym_id                      uuid not null references public.gyms(id) on delete cascade,
  student_id                  uuid not null references public.students(id) on delete cascade,
  product_id                  uuid references public.products(id) on delete set null,
  quantity                    integer not null default 1 check (quantity > 0),
  amount_cents                integer not null check (amount_cents >= 0),
  status                      text not null default 'pending'
                                check (status in
                                  ('pending','paid','failed','refunded','manual')),
  stripe_checkout_session_id  text unique,
  stripe_payment_intent_id    text,
  notes                       text,
  credits_granted             integer not null default 0,
  expires_at                  timestamptz,
  created_at                  timestamptz not null default now()
);

create index if not exists purchases_student_idx
  on public.purchases (student_id, created_at desc);
create index if not exists purchases_gym_idx
  on public.purchases (gym_id, created_at desc);
create index if not exists purchases_session_idx
  on public.purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

------------------------------------------------------------------------------
-- student_credits: running balance of class credits and gift-card dollars.
------------------------------------------------------------------------------
create table if not exists public.student_credits (
  student_id              uuid primary key
                            references public.students(id) on delete cascade,
  class_credits           integer not null default 0
                            check (class_credits >= 0),
  gift_card_balance_cents integer not null default 0
                            check (gift_card_balance_cents >= 0),
  updated_at              timestamptz not null default now()
);

------------------------------------------------------------------------------
-- RLS
------------------------------------------------------------------------------
alter table public.products         enable row level security;
alter table public.purchases        enable row level security;
alter table public.student_credits  enable row level security;

do $$ begin
  create policy products_same_gym on public.products for all
    using (gym_id = public.user_gym_id())
    with check (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy purchases_same_gym on public.purchases for all
    using (gym_id = public.user_gym_id())
    with check (gym_id = public.user_gym_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy student_credits_same_gym on public.student_credits for all
    using (
      exists (
        select 1 from public.students s
        where s.id = student_credits.student_id
          and s.gym_id = public.user_gym_id()
      )
    )
    with check (
      exists (
        select 1 from public.students s
        where s.id = student_credits.student_id
          and s.gym_id = public.user_gym_id()
      )
    );
exception when duplicate_object then null; end $$;
