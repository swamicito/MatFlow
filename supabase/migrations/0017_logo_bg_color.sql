-- Add logo background color column to the gyms table.
-- Default '#111111' ensures existing logos remain visible on a dark surface.
alter table public.gyms
  add column if not exists logo_bg_color text not null default '#111111';
