
-- 1. Report upvotes table
CREATE TABLE public.report_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.waste_reports(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, user_id)
);
ALTER TABLE public.report_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can upvote" ON public.report_upvotes FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove own upvote" ON public.report_upvotes FOR DELETE
  USING (user_id = auth.uid());
CREATE POLICY "Anyone can see upvotes" ON public.report_upvotes FOR SELECT
  USING (true);

-- 2. Add credibility_score to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credibility_score integer NOT NULL DEFAULT 50;

-- 3. Zones table
CREATE TABLE public.zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  boundary_coords jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view zones" ON public.zones FOR SELECT USING (true);
CREATE POLICY "Admins manage zones" ON public.zones FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update zones" ON public.zones FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete zones" ON public.zones FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- 4. Zone staff mapping
CREATE TABLE public.zone_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.zones(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'worker',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(zone_id, user_id)
);
ALTER TABLE public.zone_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view zone staff" ON public.zone_staff FOR SELECT USING (true);
CREATE POLICY "Admins manage zone staff" ON public.zone_staff FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins update zone staff" ON public.zone_staff FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins delete zone staff" ON public.zone_staff FOR DELETE
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));

-- 5. Add time tracking to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS materials_used text;

-- 6. Events table for community module
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  location_name text,
  latitude numeric,
  longitude numeric,
  organizer_id uuid NOT NULL,
  max_volunteers integer,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Admins create events" ON public.events FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'supervisor'));
CREATE POLICY "Admins update events" ON public.events FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR (organizer_id = auth.uid()));
CREATE POLICY "Admins delete events" ON public.events FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- 7. Event volunteers
CREATE TABLE public.event_volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_volunteers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view volunteers" ON public.event_volunteers FOR SELECT USING (true);
CREATE POLICY "Users join events" ON public.event_volunteers FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users leave events" ON public.event_volunteers FOR DELETE
  USING (user_id = auth.uid());

-- 8. Recycling contacts
CREATE TABLE public.recycling_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  latitude numeric,
  longitude numeric,
  waste_types text[] DEFAULT '{}',
  service_type text NOT NULL DEFAULT 'household',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.recycling_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view recycling contacts" ON public.recycling_contacts FOR SELECT USING (true);
CREATE POLICY "Admins manage contacts" ON public.recycling_contacts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update contacts" ON public.recycling_contacts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete contacts" ON public.recycling_contacts FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- 9. Add upvote_count to waste_reports for performance
ALTER TABLE public.waste_reports ADD COLUMN IF NOT EXISTS upvote_count integer NOT NULL DEFAULT 0;

-- 10. Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.waste_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 11. Triggers for updated_at
CREATE TRIGGER update_zones_updated_at BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
