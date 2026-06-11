-- Add custom branding columns to the gyms table.
-- logo_url already exists from an earlier migration.
alter table public.gyms
  add column if not exists primary_color   text not null default '#ffffff',
  add column if not exists secondary_color text not null default '#000000',
  add column if not exists accent_color    text not null default '#666666';
