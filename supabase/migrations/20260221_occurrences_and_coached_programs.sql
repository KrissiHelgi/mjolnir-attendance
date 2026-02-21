-- Migration: Refactor to class_occurrences + coached_programs (no class_instances)
-- Run this after the original schema. Drops class_instances, adds class_occurrences and profile column.

create extension if not exists "uuid-ossp";

-- 1. Add coached_programs to profiles
alter table public.profiles
  add column if not exists coached_programs text[] not null default '{}';

-- 2. Remove default_coach_id from class_templates if present
alter table public.class_templates
  drop column if exists default_coach_id;

-- 3. New table: class_occurrences
create table if not exists public.class_occurrences (
  id uuid default gen_random_uuid() primary key,
  class_template_id uuid references public.class_templates(id) on delete cascade not null,
  local_date date not null,
  starts_at timestamptz,
  unique(class_template_id, local_date)
);

alter table public.class_occurrences enable row level security;

drop policy if exists "Authenticated users can read occurrences" on public.class_occurrences;
create policy "Authenticated users can read occurrences"
  on public.class_occurrences for select to authenticated using (true);
drop policy if exists "Authenticated users can insert occurrences" on public.class_occurrences;
create policy "Authenticated users can insert occurrences"
  on public.class_occurrences for insert to authenticated with check (true);

-- 4. New attendance_logs table (replace old one)
-- Backup old data if needed, then drop and recreate
alter table if exists public.attendance_logs drop constraint if exists attendance_logs_class_instance_id_fkey;
drop table if exists public.attendance_logs;

create table public.attendance_logs (
  id uuid default gen_random_uuid() primary key,
  class_occurrence_id uuid references public.class_occurrences(id) on delete cascade unique not null,
  headcount int not null check (headcount >= 0),
  created_by uuid references public.profiles(id) on delete restrict not null,
  created_at timestamptz default now() not null,
  notes text
);

alter table public.attendance_logs enable row level security;

drop policy if exists "Authenticated users can read attendance" on public.attendance_logs;
create policy "Authenticated users can read attendance"
  on public.attendance_logs for select to authenticated using (true);

-- Helper for RLS (must exist before policy that uses it)
create or replace function public.coach_can_log_for_occurrence(occ_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select public.is_admin()
  or exists (
    select 1 from public.class_occurrences o
    join public.class_templates t on t.id = o.class_template_id
    join public.profiles p on p.id = auth.uid()
    where o.id = occ_id and (p.coached_programs @> array[t.program])
  );
$$;

drop policy if exists "Admins and coaches can log attendance" on public.attendance_logs;
create policy "Admins and coaches can log attendance"
  on public.attendance_logs for all
  using (public.coach_can_log_for_occurrence(class_occurrence_id))
  with check (public.coach_can_log_for_occurrence(class_occurrence_id));

-- 5. Allow users to update own profile
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);

-- 6. Drop class_instances and its policies
drop policy if exists "Authenticated users can read instances" on public.class_instances;
drop policy if exists "Admins can manage instances" on public.class_instances;
drop table if exists public.class_instances;
