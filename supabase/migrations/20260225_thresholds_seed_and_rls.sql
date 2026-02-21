-- Allow authenticated users to read thresholds (e.g. for alerts display)
create policy "Authenticated users can read program_thresholds"
  on public.program_thresholds for select
  to authenticated
  using (true);

-- Idempotent seed: insert only missing programs (KEEP EXISTING values)
-- Defaults: bjj 10, mma 8, box 6, kickbox 8, vikingathrek 6, vx 6, v6_semi_privates 4, sjalfsvorn 8, heljardaetur 8, mommuthrek 6
insert into public.program_thresholds (program, min_headcount)
values
  ('bjj', 10),
  ('mma', 8),
  ('box', 6),
  ('kickbox', 8),
  ('vikingathrek', 6),
  ('vx', 6),
  ('v6_semi_privates', 4),
  ('sjalfsvorn', 8),
  ('heljardaetur', 8),
  ('mommuthrek', 6)
on conflict (program) do nothing;
