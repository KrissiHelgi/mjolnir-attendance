-- Attendance 1-hour edit lock: starts_at required, attendance updated_at + locked

-- class_occurrences: make starts_at NOT NULL (backfill existing rows first if any)
-- If you have rows with NULL starts_at, set them from template + local_date before running:
-- UPDATE class_occurrences o SET starts_at = (local_date + t.start_time)::timestamptz
-- FROM class_templates t WHERE t.id = o.class_template_id AND o.starts_at IS NULL;
alter table public.class_occurrences
  alter column starts_at set not null;

-- attendance_logs: add updated_at and locked
alter table public.attendance_logs
  add column if not exists updated_at timestamptz default now() not null;

alter table public.attendance_logs
  add column if not exists locked boolean not null default false;

-- Ensure updated_at trigger exists
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_attendance_logs_updated_at on public.attendance_logs;
create trigger update_attendance_logs_updated_at
  before update on public.attendance_logs
  for each row execute procedure public.handle_updated_at();
