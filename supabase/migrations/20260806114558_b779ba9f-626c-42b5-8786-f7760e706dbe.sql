REVOKE EXECUTE ON FUNCTION public.admin_exists() FROM authenticated, anon, public;
DROP FUNCTION IF EXISTS public.claim_admin();

CREATE OR REPLACE FUNCTION public.claim_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _user_id IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RETURN false;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_admin(uuid) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.claim_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO service_role;