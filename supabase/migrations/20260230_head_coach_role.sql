-- Allow head_coach role in profiles (super admin can assign in Coach management)
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'coach', 'head_coach'));
