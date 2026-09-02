ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS fine_amount numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS superfine_amount numeric NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS advance_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_returned_at date,
  ADD COLUMN IF NOT EXISTS advance_returned_amount numeric;

UPDATE public.students
SET fine_amount = CASE WHEN slab = 'higher' THEN 100 ELSE 50 END,
    superfine_amount = CASE WHEN slab = 'higher' THEN 200 ELSE 100 END;

CREATE OR REPLACE FUNCTION public.protect_student_admin_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW.application_no := OLD.application_no;
  NEW.user_id := OLD.user_id;
  NEW.roll_number := OLD.roll_number;
  NEW.slab := OLD.slab;
  NEW.blacklisted := OLD.blacklisted;
  NEW.blacklist_reason := OLD.blacklist_reason;
  NEW.date_of_joining := OLD.date_of_joining;
  NEW.pickup_seq := OLD.pickup_seq;
  NEW.fine_amount := OLD.fine_amount;
  NEW.superfine_amount := OLD.superfine_amount;
  NEW.advance_amount := OLD.advance_amount;
  NEW.advance_returned_at := OLD.advance_returned_at;
  NEW.advance_returned_amount := OLD.advance_returned_amount;
  IF OLD.status = 'rejected' AND NEW.status = 'pending' THEN
    NEW.rejection_reason := NULL;
  ELSE
    NEW.status := OLD.status;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$function$;