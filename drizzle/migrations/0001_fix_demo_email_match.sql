CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role app_role;
BEGIN
  v_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' IN ('citizen','worker') THEN (NEW.raw_user_meta_data->>'role')::app_role
    WHEN NEW.raw_user_meta_data->>'role' IN ('supervisor','admin') AND NEW.email = ('demo.' || (NEW.raw_user_meta_data->>'role') || '@demo.local')
      THEN (NEW.raw_user_meta_data->>'role')::app_role
    ELSE 'citizen' END;
  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email, v_role);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END; $$;