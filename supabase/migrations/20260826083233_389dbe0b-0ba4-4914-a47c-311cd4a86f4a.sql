ALTER TABLE public.students ADD COLUMN IF NOT EXISTS advance_limit numeric NOT NULL DEFAULT 0;

UPDATE public.students SET advance_limit = COALESCE(advance_amount, 0) WHERE advance_limit = 0;

CREATE OR REPLACE FUNCTION public.protect_student_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.status := OLD.status;
  NEW.roll_number := OLD.roll_number;
  NEW.slab := OLD.slab;
  NEW.blacklisted := OLD.blacklisted;
  NEW.blacklist_reason := OLD.blacklist_reason;
  NEW.application_no := OLD.application_no;
  NEW.user_id := OLD.user_id;
  NEW.date_of_joining := OLD.date_of_joining;
  NEW.pickup_seq := OLD.pickup_seq;
  NEW.frozen_at := OLD.frozen_at;
  NEW.closed_at := OLD.closed_at;
  NEW.settlement_amount := OLD.settlement_amount;
  NEW.fine_amount := OLD.fine_amount;
  NEW.superfine_amount := OLD.superfine_amount;
  NEW.advance_amount := OLD.advance_amount;
  NEW.advance_limit := OLD.advance_limit;
  NEW.advance_returned_at := OLD.advance_returned_at;
  NEW.advance_returned_amount := OLD.advance_returned_amount;
  NEW.email := OLD.email;
  RETURN NEW;
END;
$$;