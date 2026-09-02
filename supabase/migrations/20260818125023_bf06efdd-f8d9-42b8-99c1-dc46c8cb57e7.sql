CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_no text NOT NULL UNIQUE,
  txn_date date NOT NULL,
  kind text NOT NULL,
  note text,
  created_by uuid REFERENCES auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage transactions" ON public.transactions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Signed in can read transactions" ON public.transactions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.transaction_counters (
  day date PRIMARY KEY,
  last_no integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.transaction_counters TO service_role;
ALTER TABLE public.transaction_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_txn_no(_day date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.transaction_counters (day, last_no) VALUES (_day, 1)
  ON CONFLICT (day) DO UPDATE SET last_no = public.transaction_counters.last_no + 1, updated_at = now()
  RETURNING last_no INTO n;
  RETURN 'TXN-' || to_char(_day, 'YYYYMMDD') || '-' || lpad(n::text, 4, '0');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.next_txn_no(date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_txn_no(date) TO service_role;

ALTER TABLE public.payments ADD COLUMN txn_no text, ADD COLUMN voided_at timestamptz;
ALTER TABLE public.expenses ADD COLUMN txn_no text, ADD COLUMN voided_at timestamptz;
ALTER TABLE public.other_income ADD COLUMN txn_no text, ADD COLUMN voided_at timestamptz;
CREATE INDEX payments_txn_no_idx ON public.payments(txn_no);
CREATE INDEX expenses_txn_no_idx ON public.expenses(txn_no);
CREATE INDEX other_income_txn_no_idx ON public.other_income(txn_no);

DO $$
DECLARE r record; n text;
BEGIN
  FOR r IN SELECT id, value_date AS d FROM public.payments ORDER BY paid_at LOOP
    n := public.next_txn_no(r.d);
    INSERT INTO public.transactions (txn_no, txn_date, kind, note) VALUES (n, r.d, 'fee', 'Recorded before transaction numbers');
    UPDATE public.payments SET txn_no = n WHERE id = r.id;
  END LOOP;
  FOR r IN SELECT id, income_date AS d FROM public.other_income ORDER BY created_at LOOP
    n := public.next_txn_no(r.d);
    INSERT INTO public.transactions (txn_no, txn_date, kind, note) VALUES (n, r.d, 'other_income', 'Recorded before transaction numbers');
    UPDATE public.other_income SET txn_no = n WHERE id = r.id;
  END LOOP;
  FOR r IN SELECT id, expense_date AS d FROM public.expenses ORDER BY created_at LOOP
    n := public.next_txn_no(r.d);
    INSERT INTO public.transactions (txn_no, txn_date, kind, note) VALUES (n, r.d, 'expense', 'Recorded before transaction numbers');
    UPDATE public.expenses SET txn_no = n WHERE id = r.id;
  END LOOP;
END $$;