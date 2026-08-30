CREATE TYPE public.pickup_status AS ENUM ('requested','confirmed','on_the_way','completed','cancelled');

CREATE TABLE public.pickup_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  waste_type text NOT NULL,
  preferred_date date NOT NULL,
  time_slot text NOT NULL DEFAULT 'morning',
  contact_phone text NOT NULL,
  address text,
  latitude numeric,
  longitude numeric,
  quantity_kg numeric,
  notes text,
  photo_url text,
  contact_id uuid REFERENCES public.recycling_contacts(id) ON DELETE SET NULL,
  status public.pickup_status NOT NULL DEFAULT 'requested',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pickup_requests TO authenticated;
GRANT ALL ON public.pickup_requests TO service_role;

ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own pickup requests"
ON public.pickup_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users and staff view pickup requests"
ON public.pickup_requests FOR SELECT TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users and staff update pickup requests"
ON public.pickup_requests FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR has_role(auth.uid(), 'supervisor'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_pickup_requests_updated_at
BEFORE UPDATE ON public.pickup_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_pickup_requests_user ON public.pickup_requests(user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pickup_requests;
ALTER TABLE public.pickup_requests REPLICA IDENTITY FULL;