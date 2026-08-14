ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS pickup_seq integer;

WITH ordered AS (
  SELECT id, row_number() OVER (ORDER BY roll_number NULLS LAST, application_no) AS rn
  FROM public.students
  WHERE status = 'approved'
)
UPDATE public.students s
SET pickup_seq = ordered.rn
FROM ordered
WHERE s.id = ordered.id AND s.pickup_seq IS NULL;