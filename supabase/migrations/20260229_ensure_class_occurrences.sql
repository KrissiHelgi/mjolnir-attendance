-- Ensure class_occurrences exists (fixes "table not in schema cache" when migration 20260221 wasn't run)
create table if not exists public.class_occurrences (
  id uuid default uuid_generate_v4() primary key,
  class_template_id uuid references public.class_templates(id) on delete cascade not null,
  local_date date not null,
  starts_at timestamptz not null,
  unique(class_template_id, local_date)
);

alter table public.class_occurrences enable row level security;

drop policy if exists "Authenticated users can read occurrences" on public.class_occurrences;
create policy "Authenticated users can read occurrences"
  on public.class_occurrences for select to authenticated using (true);

drop policy if exists "Authenticated users can insert occurrences" on public.class_occurrences;
create policy "Authenticated users can insert occurrences"
  on public.class_occurrences for insert to authenticated with check (true);

-- If table existed with nullable starts_at (from 20260221), enforce NOT NULL
alter table public.class_occurrences
  alter column starts_at set not null;
