-- MatFlow: gym-level waiver template library
-- Owners can create named templates, mark them as required, and attach a PDF.
-- Signed waivers (waivers table) are separate and track per-student signatures.

create table if not exists public.waiver_templates (
  id               uuid primary key default gen_random_uuid(),
  gym_id           uuid not null references public.gyms(id) on delete cascade,
  name             text not null,
  required         boolean not null default false,
  pdf_template_url text,
  created_at       timestamptz not null default now()
);

create index if not exists waiver_templates_gym_idx on public.waiver_templates(gym_id);

alter table public.waiver_templates enable row level security;

drop policy if exists "waiver_templates_rw" on public.waiver_templates;
create policy "waiver_templates_rw" on public.waiver_templates
  for all to authenticated
  using (gym_id = public.user_gym_id())
  with check (gym_id = public.user_gym_id());
