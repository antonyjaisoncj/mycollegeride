ALTER TABLE public.payments ADD COLUMN settled boolean NOT NULL DEFAULT true;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_student_id_period_key;
DROP INDEX IF EXISTS public.payments_student_id_period_key;
CREATE UNIQUE INDEX payments_student_period_settled_key ON public.payments (student_id, period) WHERE settled AND voided_at IS NULL;