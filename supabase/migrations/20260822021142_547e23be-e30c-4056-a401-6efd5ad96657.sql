CREATE TABLE public.advance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL CHECK (kind IN ('collect','return')),
  amount numeric NOT NULL,
  mode payment_mode NOT NULL DEFAULT 'cash',
  note text,
  txn_no text,
  voided_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX advance_entries_student_idx ON public.advance_entries (student_id, entry_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advance_entries TO authenticated;
GRANT ALL ON public.advance_entries TO service_role;

ALTER TABLE public.advance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage advance entries" ON public.advance_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students read own advance entries" ON public.advance_entries
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.id = advance_entries.student_id AND s.user_id = auth.uid()));