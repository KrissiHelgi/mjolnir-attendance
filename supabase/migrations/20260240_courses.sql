-- Courses: time-bounded groups of class sessions (e.g. 4–8 week course, 2–4 classes/week).
-- Sessions are linked via class_occurrences.course_id.

create table if not exists public.courses (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  program text,
  start_date date not null,
  end_date date not null,
  created_at timestamptz default now() not null,
  constraint courses_dates check (end_date >= start_date)
);

alter table public.courses enable row level security;

create policy "Authenticated users can read courses"
  on public.courses for select to authenticated using (true);

create policy "Admins can manage courses"
  on public.courses for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Link occurrences to a course (nullable).
alter table public.class_occurrences
  add column if not exists course_id uuid references public.courses(id) on delete set null;

create index if not exists idx_class_occurrences_course_id
  on public.class_occurrences(course_id);

-- Admins can update occurrences (e.g. set course_id)
create policy "Admins can update occurrences"
  on public.class_occurrences for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
