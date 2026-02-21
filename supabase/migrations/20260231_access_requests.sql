-- Access requests: coaches request access; super admin approves/denies in Coach management
create table if not exists public.access_requests (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  full_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  created_at timestamptz default now() not null,
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null
);

alter table public.access_requests enable row level security;

-- Anyone can submit a request (no auth required for the form)
create policy "Anyone can submit access request"
  on public.access_requests for insert
  with check (true);

-- Only authenticated can read (Coach management page is super-admin only; no separate RLS for super admin here)
create policy "Authenticated can read access_requests"
  on public.access_requests for select
  to authenticated
  using (true);

-- Authenticated can update (approve/deny only from Coach management)
create policy "Authenticated can update access_requests"
  on public.access_requests for update
  to authenticated
  using (true)
  with check (true);
