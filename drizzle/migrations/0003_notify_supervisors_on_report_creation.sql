CREATE OR REPLACE FUNCTION public.notify_new_report() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.notifications(user_id,title,message,type)
 SELECT DISTINCT ur.user_id,
 CASE WHEN NEW.waste_type='hazardous' THEN 'New hazard report' ELSE 'New citizen report' END,
 left(NEW.waste_type || ' reported' || coalesce(' near ' || NEW.address,'') || ' (#' || left(NEW.id::text,8) || ')',1000),
 CASE WHEN NEW.waste_type='hazardous' THEN 'hazard' ELSE 'report' END
 FROM public.user_roles ur WHERE ur.user_id <> NEW.reporter_id AND (ur.role='supervisor' OR (ur.role='admin' AND NEW.waste_type='hazardous' AND NEW.description LIKE '%Severity: HIGH%'));
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.notify_new_report() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER notify_supervisors_after_report AFTER INSERT ON public.waste_reports FOR EACH ROW EXECUTE FUNCTION public.notify_new_report();