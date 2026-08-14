CREATE POLICY "Students update own registration"
ON public.students
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.protect_student_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
  IF OLD.status = 'rejected' AND NEW.status = 'pending' THEN
    NEW.rejection_reason := NULL;
  ELSE
    NEW.status := OLD.status;
    NEW.rejection_reason := OLD.rejection_reason;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS students_protect_admin_fields ON public.students;
CREATE TRIGGER students_protect_admin_fields
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.protect_student_admin_fields();