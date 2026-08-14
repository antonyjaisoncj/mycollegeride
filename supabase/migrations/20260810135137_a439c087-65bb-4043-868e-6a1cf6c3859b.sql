CREATE OR REPLACE FUNCTION public.next_receipt_no(_period date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.receipt_counters (period, last_no)
  VALUES (date_trunc('month', _period)::date, 1)
  ON CONFLICT (period) DO UPDATE
    SET last_no = public.receipt_counters.last_no + 1, updated_at = now()
  RETURNING last_no INTO n;
  RETURN 'RCT-' || to_char(_period, 'YYYYMM') || '-' || lpad(n::text, 4, '0');
END;
$function$;

REVOKE ALL ON FUNCTION public.next_receipt_no(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_no(date) TO service_role;