-- Store coach name on log for display ("Coach X confirmed attendance") without joining profiles.
alter table public.attendance_logs
  add column if not exists created_by_name text;

update public.attendance_logs l
set created_by_name = coalesce(p.full_name, 'Coach')
from public.profiles p
where l.created_by = p.id and l.created_by_name is null;
