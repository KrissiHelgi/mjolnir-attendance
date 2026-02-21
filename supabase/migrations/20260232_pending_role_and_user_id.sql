-- Allow role 'pending' for new signups awaiting admin approval
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'coach', 'head_coach', 'pending'));

-- Link access_requests to auth user when they created an account
alter table public.access_requests
  add column if not exists user_id uuid references auth.users(id) on delete set null;
