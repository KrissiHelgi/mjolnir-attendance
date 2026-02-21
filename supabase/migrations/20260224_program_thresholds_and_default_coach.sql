-- Optional: default coach per template (for scheduled-coach attribution in analytics)
alter table public.class_templates
  add column if not exists default_coach_id uuid references public.profiles(id) on delete set null;

-- Per-program low-attendance thresholds (admin-configurable)
create table if not exists public.program_thresholds (
  program text primary key,
  min_headcount int not null check (min_headcount >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS: only admins can read/update thresholds
alter table public.program_thresholds enable row level security;

create policy "Admins can read program_thresholds"
  on public.program_thresholds for select
  using (public.is_admin());

create policy "Admins can insert program_thresholds"
  on public.program_thresholds for insert
  with check (public.is_admin());

create policy "Admins can update program_thresholds"
  on public.program_thresholds for update
  using (public.is_admin());

create policy "Admins can delete program_thresholds"
  on public.program_thresholds for delete
  using (public.is_admin());

-- Trigger updated_at for program_thresholds
create or replace function public.handle_thresholds_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_program_thresholds_updated_at on public.program_thresholds;
create trigger update_program_thresholds_updated_at
  before update on public.program_thresholds
  for each row execute procedure public.handle_thresholds_updated_at();

-- Seed default thresholds (only if missing; see 20260225 for idempotent policy)
insert into public.program_thresholds (program, min_headcount)
values
  ('bjj', 10),
  ('mma', 8),
  ('box', 6),
  ('kickbox', 8),
  ('vikingathrek', 6),
  ('vx', 6),
  ('v6_semi_privates', 4),
  ('sjalfsvorn', 8),
  ('heljardaetur', 8),
  ('mommuthrek', 6)
on conflict (program) do nothing;
