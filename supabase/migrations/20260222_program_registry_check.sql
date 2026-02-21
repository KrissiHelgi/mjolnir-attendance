-- Enforce program key constraint on class_templates (keys from Program Registry)
-- Run after ensuring existing rows use valid keys; fix any invalid program values first if needed.

alter table public.class_templates
  drop constraint if exists class_templates_program_check;

alter table public.class_templates
  add constraint class_templates_program_check check (program = any (array[
    'bjj', 'mma', 'box', 'kickbox', 'vikingathrek', 'vx',
    'v6_semi_privates', 'sjalfsvorn', 'heljardaetur', 'mommuthrek'
  ]));
