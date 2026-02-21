-- App settings (key-value, e.g. schedule CSV URL)
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now() not null
);

alter table public.app_settings enable row level security;

drop policy if exists "Authenticated users can read app_settings" on public.app_settings;
create policy "Authenticated users can read app_settings"
  on public.app_settings for select to authenticated using (true);

drop policy if exists "Admins can insert app_settings" on public.app_settings;
create policy "Admins can insert app_settings"
  on public.app_settings for insert with check (public.is_admin());

drop policy if exists "Admins can update app_settings" on public.app_settings;
create policy "Admins can update app_settings"
  on public.app_settings for update using (public.is_admin());

drop trigger if exists update_app_settings_updated_at on public.app_settings;
create trigger update_app_settings_updated_at
  before update on public.app_settings
  for each row execute procedure public.handle_updated_at();

-- Seed default CSV export URL (public sheet export)
insert into public.app_settings (key, value)
values ('schedule_csv_url', 'https://docs.google.com/spreadsheets/d/123ExSUtuT3CQNxbSNGOsLoDczPbtJPScKn-H2Mc59F0/export?format=csv&gid=0')
on conflict (key) do nothing;

-- Transactional sync: delete all class_templates and insert from JSON. Admin-only.
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
    insert into public.class_templates (program, title, weekday, start_time, duration_minutes, location, capacity)
    select
      (e->>'program')::text,
      (e->>'title')::text,
      (e->>'weekday')::int,
      (e->>'start_time')::time,
      coalesce((e->>'duration_minutes')::int, 60),
      nullif(trim(e->>'location'), ''),
      (e->>'capacity')::int
    from jsonb_array_elements(p_templates) as e;
  end if;
end;
$$;
