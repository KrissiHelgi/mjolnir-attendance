-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  role text check (role in ('admin', 'coach', 'head_coach', 'pending')) not null default 'coach',
  coached_programs text[] not null default '{}',
  created_at timestamptz default now() not null
);

-- Class templates: weekly base schedule (recurring). program can be any text (see migration 20260234 for allowing custom programs).
create table public.class_templates (
  id uuid default uuid_generate_v4() primary key,
  program text not null,
  title text not null,
  weekday int check (weekday >= 0 and weekday <= 6) not null,
  start_time time not null,
  location text,
  capacity int,
  duration_minutes int not null default 60 check (duration_minutes > 0),
  default_coach_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- App settings (key-value, e.g. schedule CSV URL)
create table public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now() not null
);

-- Access requests: coaches request access; super admin approves/denies in Coach management
create table public.access_requests (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz default now() not null,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);

-- Per-program low-attendance thresholds (admin-configurable)
create table public.program_thresholds (
  program text primary key,
  min_headcount int not null check (min_headcount >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Class occurrences: one per (template, local_date); starts_at required for 1h lock
create table public.class_occurrences (
  id uuid default uuid_generate_v4() primary key,
  class_template_id uuid references public.class_templates(id) on delete cascade not null,
  local_date date not null,
  starts_at timestamptz not null,
  unique(class_template_id, local_date)
);

-- Attendance: one log per occurrence; updated_at for audit; locked set by app if needed
create table public.attendance_logs (
  id uuid default uuid_generate_v4() primary key,
  class_occurrence_id uuid references public.class_occurrences(id) on delete cascade unique not null,
  headcount int not null check (headcount >= 0),
  created_by uuid references public.profiles(id) on delete restrict not null,
  created_by_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  notes text,
  locked boolean not null default false
);

-- RLS
alter table public.profiles enable row level security;
alter table public.class_templates enable row level security;
alter table public.class_occurrences enable row level security;
alter table public.attendance_logs enable row level security;
alter table public.program_thresholds enable row level security;
alter table public.app_settings enable row level security;
alter table public.access_requests enable row level security;

-- SECURITY DEFINER helpers (bypass RLS, avoid recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Returns true if current user is admin or has role coach/head_coach (can log any class; profile programs are for filtering only)
create or replace function public.coach_can_log_for_occurrence(occ_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('coach', 'head_coach')
  );
$$;

-- Profiles: user can read/update own row only (no select from profiles in policy)
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Class templates: authenticated read; admin write
create policy "Authenticated users can read templates"
  on public.class_templates for select
  to authenticated
  using (true);

create policy "Admins can manage templates"
  on public.class_templates for all
  using (public.is_admin());

-- Program thresholds: authenticated read; admins write
create policy "Authenticated users can read program_thresholds"
  on public.program_thresholds for select to authenticated using (true);
create policy "Admins can insert program_thresholds"
  on public.program_thresholds for insert with check (public.is_admin());
create policy "Admins can update program_thresholds"
  on public.program_thresholds for update using (public.is_admin());
create policy "Admins can delete program_thresholds"
  on public.program_thresholds for delete using (public.is_admin());

-- App settings: authenticated read; admin write
create policy "Authenticated users can read app_settings"
  on public.app_settings for select to authenticated using (true);
create policy "Admins can insert app_settings"
  on public.app_settings for insert with check (public.is_admin());
create policy "Admins can update app_settings"
  on public.app_settings for update using (public.is_admin());

create policy "Anyone can submit access request"
  on public.access_requests for insert with check (true);
create policy "Authenticated can read access_requests"
  on public.access_requests for select to authenticated using (true);
create policy "Authenticated can update access_requests"
  on public.access_requests for update to authenticated using (true) with check (true);

-- Class occurrences: authenticated read/insert (for get-or-create on dashboard)
create policy "Authenticated users can read occurrences"
  on public.class_occurrences for select
  to authenticated
  using (true);

create policy "Authenticated users can insert occurrences"
  on public.class_occurrences for insert
  to authenticated
  with check (true);

-- Attendance: authenticated read; admin or coach (for that program) can insert/update
create policy "Authenticated users can read attendance"
  on public.attendance_logs for select
  to authenticated
  using (true);

create policy "Admins and coaches can log attendance"
  on public.attendance_logs for all
  using (public.coach_can_log_for_occurrence(class_occurrence_id))
  with check (public.coach_can_log_for_occurrence(class_occurrence_id));

-- Trigger: create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'coach')::text
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger: updated_at for templates
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_class_templates_updated_at
  before update on public.class_templates
  for each row execute procedure public.handle_updated_at();

create trigger update_attendance_logs_updated_at
  before update on public.attendance_logs
  for each row execute procedure public.handle_updated_at();

create trigger update_program_thresholds_updated_at
  before update on public.program_thresholds
  for each row execute procedure public.handle_updated_at();

create trigger update_app_settings_updated_at
  before update on public.app_settings
  for each row execute procedure public.handle_updated_at();

-- Transactional sync: delete all class_templates and insert from JSON. Admin-only.
create or replace function public.sync_class_templates(p_templates jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Unauthorized'; end if;
  delete from public.class_templates where true;
  if jsonb_array_length(p_templates) > 0 then
    insert into public.class_templates (program, title, weekday, start_time, location, capacity, duration_minutes)
    select (e->>'program')::text, (e->>'title')::text, (e->>'weekday')::int, (e->>'start_time')::time,
           nullif(trim(e->>'location'), ''), (e->>'capacity')::int, case when (e->>'duration_minutes')::int is null or (e->>'duration_minutes')::int < 1 then 60 else (e->>'duration_minutes')::int end
    from jsonb_array_elements(p_templates) as e;
  end if;
end; $$;
