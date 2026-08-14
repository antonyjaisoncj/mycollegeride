ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS value_date date NOT NULL DEFAULT current_date;
UPDATE public.payments SET value_date = (paid_at AT TIME ZONE 'UTC')::date;

CREATE TABLE IF NOT EXISTS public.receipt_counters (
  period date PRIMARY KEY,
  last_no integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.receipt_counters TO service_role;
ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage receipt counters" ON public.receipt_counters
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.next_receipt_no(_period date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.receipt_counters (period, last_no)
  VALUES (date_trunc('month', _period)::date, 1)
  ON CONFLICT (period) DO UPDATE
    SET last_no = public.receipt_counters.last_no + 1, updated_at = now()
  RETURNING last_no INTO n;
  RETURN 'RCT-' || to_char(_period, 'YYYYMM') || '-' || lpad(n::text, 4, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_receipt_no(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_receipt_no(date) TO authenticated, service_role;