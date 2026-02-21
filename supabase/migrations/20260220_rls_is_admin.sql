-- Migration: RLS policies using is_admin() to avoid recursion on profiles
-- Run this if you already applied the original schema and need to update RLS.

-- 1. Add SECURITY DEFINER helper (bypasses RLS when called from policies)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 2. Drop old policies that queried profiles (causing recursion risk)
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can manage templates" on public.class_templates;
drop policy if exists "Admins can manage instances" on public.class_instances;
drop policy if exists "Admins and assigned coaches can log attendance" on public.attendance_logs;

-- 3. Recreate "Admins can read all profiles" using is_admin() only
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- 4. Recreate template/instance/attendance policies using is_admin()
create policy "Admins can manage templates"
  on public.class_templates for all
  using (public.is_admin());

create policy "Admins can manage instances"
  on public.class_instances for all
  using (public.is_admin());

create policy "Admins and assigned coaches can log attendance"
  on public.attendance_logs for all
  using (
    public.is_admin()
    or exists (
      select 1 from public.class_instances ci
      where ci.id = attendance_logs.class_instance_id
      and ci.coach_id = auth.uid()
    )
  );
