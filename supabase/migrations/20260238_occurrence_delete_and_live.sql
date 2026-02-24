-- Allow admins to delete class occurrences (removes this instance only; template stays for next week).
create policy "Admins can delete occurrences"
  on public.class_occurrences for delete
  to authenticated
  using (public.is_admin());

-- Live flag: hide class from dashboard when false (e.g. every other month, uncertain schedule).
alter table public.class_templates
  add column if not exists live boolean not null default true;

-- Ensure all existing classes are live (default above applies to new rows; this fixes any existing rows).
update public.class_templates set live = true where live is not true;
