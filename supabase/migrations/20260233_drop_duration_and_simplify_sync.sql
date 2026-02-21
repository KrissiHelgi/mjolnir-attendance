-- Remove duration from class_templates (product simplification).
alter table public.class_templates drop column if exists duration_minutes;

-- Update sync_class_templates: accept only program, title, weekday, start_time, location, capacity.
create or replace function public.sync_class_templates(p_templates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;
  delete from public.class_templates where true;
  if jsonb_array_length(p_templates) > 0 then
    insert into public.class_templates (program, title, weekday, start_time, location, capacity)
    select
      (e->>'program')::text,
      (e->>'title')::text,
      (e->>'weekday')::int,
      (e->>'start_time')::time,
      nullif(trim(e->>'location'), ''),
      (e->>'capacity')::int
    from jsonb_array_elements(p_templates) as e;
  end if;
end;
$$;
