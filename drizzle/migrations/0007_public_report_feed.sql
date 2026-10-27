CREATE OR REPLACE FUNCTION public.get_public_report_feed(p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, waste_type text, description text, quantity_kg numeric, address text, status report_status, photo_urls text[], upvote_count integer, created_at timestamptz, is_anonymous boolean, reporter_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT r.id, r.waste_type, r.description, r.quantity_kg, r.address, r.status, r.photo_urls, r.upvote_count, r.created_at, r.is_anonymous,
    CASE WHEN r.is_anonymous THEN NULL ELSE coalesce(p.display_name,'Citizen') END
  FROM public.waste_reports r LEFT JOIN public.profiles p ON p.id = r.reporter_id
  WHERE auth.uid() IS NOT NULL AND r.status <> 'rejected'
  ORDER BY r.created_at DESC LIMIT least(greatest(coalesce(p_limit,50),1),100);
$$;
REVOKE ALL ON FUNCTION public.get_public_report_feed(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_report_feed(integer) TO authenticated;