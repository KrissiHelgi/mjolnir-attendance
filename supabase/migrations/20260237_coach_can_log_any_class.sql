-- Allow any coach/head_coach to log any class. Profile programs are for filtering "My classes" only, not permission.
create or replace function public.coach_can_log_for_occurrence(occ_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.is_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.role in ('coach', 'head_coach')
  );
$$;
