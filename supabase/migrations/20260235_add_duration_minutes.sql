-- Add duration (minutes) per class; default 60. Used for dashboard ordering (just finished / ongoing / upcoming).
alter table public.class_templates
  add column if not exists duration_minutes int not null default 60 check (duration_minutes > 0);

-- sync_class_templates: accept duration_minutes (default 60 when missing)
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
    insert into public.class_templates (program, title, weekday, start_time, location, capacity, duration_minutes)
    select
      (e->>'program')::text,
      (e->>'title')::text,
      (e->>'weekday')::int,
      (e->>'start_time')::time,
      nullif(trim(e->>'location'), ''),
      (e->>'capacity')::int,
      case when (e->>'duration_minutes')::int is null or (e->>'duration_minutes')::int < 1 then 60 else (e->>'duration_minutes')::int end
    from jsonb_array_elements(p_templates) as e;
  end if;
end;
$$;
