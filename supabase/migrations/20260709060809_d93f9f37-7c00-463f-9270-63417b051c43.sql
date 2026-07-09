ALTER TABLE public.community_posts REPLICA IDENTITY FULL;
ALTER TABLE public.waste_reports REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_reports; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;