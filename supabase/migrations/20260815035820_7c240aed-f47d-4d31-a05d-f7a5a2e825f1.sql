CREATE TABLE public.other_income (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  income_date date NOT NULL,
  particulars text NOT NULL,
  remarks text,
  amount numeric NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.other_income TO authenticated;
GRANT ALL ON public.other_income TO service_role;

ALTER TABLE public.other_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage other income"
ON public.other_income FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX other_income_date_idx ON public.other_income (income_date);

ALTER TABLE public.students
  ADD COLUMN frozen_at date,
  ADD COLUMN closed_at date,
  ADD COLUMN settlement_amount numeric;