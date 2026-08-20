-- Optional image for shop products (merch photos — rashguards, hoodies, tees).
alter table public.products
  add column if not exists image_url text;
