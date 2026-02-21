-- Ensure coached_programs exists on profiles (fixes schema cache error if column was missing)
alter table public.profiles
  add column if not exists coached_programs text[] not null default '{}';
