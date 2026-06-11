-- Per-gym "Free Class Nudge" threshold
-- Allows each gym owner to configure how many free classes trigger the nudge.

alter table public.gyms
  add column if not exists free_class_nudge_after integer not null default 4;
