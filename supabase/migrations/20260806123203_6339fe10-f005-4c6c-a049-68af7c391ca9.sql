ALTER TABLE public.students RENAME COLUMN course TO branch;

DO $$ BEGIN
  CREATE TYPE public.bus_stage AS ENUM ('Stage-1','Stage-2','Stage-3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS stage public.bus_stage NOT NULL DEFAULT 'Stage-1',
  ADD COLUMN IF NOT EXISTS photo_path text;

ALTER TABLE public.students
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN branch DROP NOT NULL,
  ALTER COLUMN year_of_study DROP NOT NULL,
  ALTER COLUMN address DROP NOT NULL,
  ALTER COLUMN boarding_point DROP NOT NULL,
  ALTER COLUMN guardian_name DROP NOT NULL,
  ALTER COLUMN guardian_phone DROP NOT NULL;