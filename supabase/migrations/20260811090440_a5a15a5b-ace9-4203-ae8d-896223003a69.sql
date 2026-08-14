ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_of_joining date;
UPDATE public.students SET date_of_joining = created_at::date WHERE date_of_joining IS NULL AND status = 'approved';