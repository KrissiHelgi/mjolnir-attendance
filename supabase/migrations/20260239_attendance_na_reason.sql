-- N/A reason for attendance: 'no_show' = counted as 0; 'cancelled' = not counted, shown in "Classes cancelled" alert.
-- null or 'no_show' = included in analytics; 'cancelled' = excluded from metrics, listed in Alerts.
alter table public.attendance_logs
  add column if not exists na_reason text check (na_reason is null or na_reason in ('no_show', 'cancelled'));
