-- Allow any program text so admins can add classes for new programs (e.g. Yoga)
-- without a code change. Coaches can still filter by coached_programs (text[]).

alter table public.class_templates
  drop constraint if exists class_templates_program_check;
