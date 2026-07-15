
CREATE OR REPLACE FUNCTION public.notify_role(
  _role app_role,
  _title text,
  _message text,
  _type text DEFAULT 'system'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT ur.user_id, _title, _message, _type
  FROM public.user_roles ur
  WHERE ur.role = _role
    AND ur.user_id <> auth.uid();

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_role(app_role, text, text, text) TO authenticated;
