ALTER TYPE public.report_status ADD VALUE IF NOT EXISTS 'verified';

ALTER TABLE public.waste_reports
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS review_reason text,
  ADD COLUMN IF NOT EXISTS flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS flagged_by uuid;

CREATE OR REPLACE FUNCTION public.award_carbon_credits(p_user_id uuid, p_amount integer, p_transaction_type text, p_description text DEFAULT NULL, p_related_report_id uuid DEFAULT NULL, p_co2_kg numeric DEFAULT 0)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal integer; v_score integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_amount > 0 AND NOT public.has_role(auth.uid(),'supervisor') AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized to award credits';
  END IF;
  IF p_amount < 0 AND p_user_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_amount < -100000 OR p_amount > 10000 THEN RAISE EXCEPTION 'Invalid credit amount'; END IF;
  IF p_amount < 0 AND (SELECT credits_balance FROM profiles WHERE id = p_user_id) + p_amount < 0 THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;
  INSERT INTO credit_transactions (user_id, amount, transaction_type, description, related_report_id, co2_kg)
  VALUES (p_user_id, p_amount, p_transaction_type, p_description, p_related_report_id, greatest(coalesce(p_co2_kg,0),0));
  UPDATE profiles SET credits_balance = credits_balance + p_amount,
    co2_saved_kg = co2_saved_kg + greatest(coalesce(p_co2_kg,0),0),
    contribution_score = contribution_score + greatest(least(p_amount,50),0)
  WHERE id = p_user_id RETURNING credits_balance, contribution_score INTO v_bal, v_score;
  IF v_bal IS NULL THEN RAISE EXCEPTION 'User profile not found'; END IF;
  UPDATE profiles SET badge_level = CASE WHEN v_score >= 5000 THEN 'Platinum' WHEN v_score >= 2000 THEN 'Gold'
    WHEN v_score >= 500 THEN 'Silver' ELSE 'Bronze' END WHERE id = p_user_id;
  RETURN v_bal;
END; $$;
REVOKE EXECUTE ON FUNCTION public.award_carbon_credits(uuid, integer, text, text, uuid, numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.award_carbon_credits(uuid, integer, text, text, uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.verify_completed_report(p_report_id uuid, p_action text, p_verified_weight numeric DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_report public.waste_reports%ROWTYPE; v_rate integer; v_weight numeric; v_credits integer; v_co2 numeric; v_now timestamptz := now();
BEGIN
  IF auth.uid() IS NULL OR (NOT public.has_role(auth.uid(),'supervisor') AND NOT public.has_role(auth.uid(),'admin')) THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_action NOT IN ('verify','flag_fake') THEN RAISE EXCEPTION 'Invalid review action'; END IF;
  SELECT * INTO v_report FROM public.waste_reports WHERE id = p_report_id FOR UPDATE;
  IF v_report.id IS NULL THEN RAISE EXCEPTION 'Report not found'; END IF;
  IF p_action = 'verify' AND v_report.status::text = 'verified' THEN
    RETURN jsonb_build_object('status','verified','credits_awarded',coalesce(v_report.credits_awarded,0),'verified_at',v_report.verified_at,'already_verified',true);
  END IF;
  IF v_report.status::text <> 'completed' THEN RAISE EXCEPTION 'Only completed reports can be reviewed'; END IF;
  IF p_action = 'flag_fake' THEN
    UPDATE public.waste_reports SET status = 'rejected', review_reason = nullif(left(trim(coalesce(p_reason,'')),500),''),
      flagged_at = v_now, flagged_by = auth.uid(), updated_at = v_now WHERE id = p_report_id;
    INSERT INTO public.notifications (user_id,title,message,type) VALUES (v_report.reporter_id,'Report flagged for review',
      'Your waste report was flagged and no carbon credits were released. Contact support if this was incorrect.','report');
    RETURN jsonb_build_object('status','rejected','credits_awarded',0,'flagged_at',v_now);
  END IF;
  v_weight := greatest(coalesce(p_verified_weight, v_report.quantity_kg, 1), 0.1);
  SELECT coalesce(max(credits_per_kg),10) INTO v_rate FROM public.waste_categories WHERE lower(name) = lower(v_report.waste_type);
  v_credits := greatest(10, round(v_weight * v_rate));
  v_co2 := round(v_weight * 2.5, 2);
  UPDATE public.waste_reports SET status = 'verified'::report_status, credits_awarded = v_credits, verified_at = v_now,
    verified_by = auth.uid(), review_reason = null, updated_at = v_now WHERE id = p_report_id;
  INSERT INTO public.credit_transactions (user_id,amount,transaction_type,description,related_report_id,co2_kg)
  VALUES (v_report.reporter_id, v_credits, 'report_verified', format('Report verified: %s', v_report.waste_type), p_report_id, v_co2);
  UPDATE public.profiles SET credits_balance = credits_balance + v_credits, co2_saved_kg = co2_saved_kg + v_co2,
    contribution_score = contribution_score + least(v_credits,50),
    badge_level = CASE WHEN contribution_score + least(v_credits,50) >= 5000 THEN 'Platinum'
      WHEN contribution_score + least(v_credits,50) >= 2000 THEN 'Gold'
      WHEN contribution_score + least(v_credits,50) >= 500 THEN 'Silver' ELSE 'Bronze' END
  WHERE id = v_report.reporter_id;
  INSERT INTO public.notifications (user_id,title,message,type) VALUES (v_report.reporter_id,'Carbon credits released',
    format('Your %s report was verified. %s carbon credits were added to your wallet.', v_report.waste_type, v_credits),'credit');
  RETURN jsonb_build_object('status','verified','credits_awarded',v_credits,'verified_at',v_now,'already_verified',false);
END; $$;
REVOKE EXECUTE ON FUNCTION public.verify_completed_report(uuid, text, numeric, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.verify_completed_report(uuid, text, numeric, text) TO authenticated;

-- notify_role: only staff may broadcast to workers/citizens
CREATE OR REPLACE FUNCTION public.notify_role(_role app_role, _title text, _message text, _type text DEFAULT 'system')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inserted_count integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _role IN ('worker','citizen') AND NOT public.has_role(auth.uid(),'supervisor') AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  INSERT INTO public.notifications (user_id,title,message,type)
  SELECT ur.user_id, left(_title,200), left(_message,1000), left(_type,50) FROM public.user_roles ur
  WHERE ur.role = _role AND ur.user_id <> auth.uid();
  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END; $$;

-- handle_new_user: never grant admin from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role app_role;
BEGIN
  v_role := CASE
    WHEN NEW.raw_user_meta_data->>'role' IN ('citizen','worker') THEN (NEW.raw_user_meta_data->>'role')::app_role
    WHEN NEW.raw_user_meta_data->>'role' IN ('supervisor','admin') AND NEW.email = ('demo-' || (NEW.raw_user_meta_data->>'role') || '@demo.local')
      THEN (NEW.raw_user_meta_data->>'role')::app_role
    ELSE 'citizen' END;
  INSERT INTO public.profiles (id, display_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)), NEW.email, v_role);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END; $$;

-- Replace permissive USING(true) read policies with authenticated-only
DROP POLICY IF EXISTS "Anyone can read categories" ON public.waste_categories;
CREATE POLICY "Signed-in users can read categories" ON public.waste_categories FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can see upvotes" ON public.report_upvotes;
CREATE POLICY "Signed-in users can see upvotes" ON public.report_upvotes FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view zones" ON public.zones;
CREATE POLICY "Signed-in users can view zones" ON public.zones FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view zone staff" ON public.zone_staff;
CREATE POLICY "Staff or self can view zone staff" ON public.zone_staff FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Anyone can view events" ON public.events;
CREATE POLICY "Signed-in users can view events" ON public.events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Anyone can view volunteers" ON public.event_volunteers;
CREATE POLICY "Self or staff can view volunteers" ON public.event_volunteers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Anyone can view recycling contacts" ON public.recycling_contacts;
CREATE POLICY "Signed-in users can view recycling contacts" ON public.recycling_contacts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Authenticated can read community posts" ON public.community_posts;
CREATE POLICY "Signed-in users can read community posts" ON public.community_posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Storage: bind uploads to the uploader's own folder
DROP POLICY IF EXISTS "Authenticated users can upload photos" ON storage.objects;
CREATE POLICY "Users upload to own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR (storage.foldername(name))[2] = auth.uid()::text));
DROP POLICY IF EXISTS "Anyone can view report photos" ON storage.objects;
CREATE POLICY "Signed-in users can view report photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'report-photos' AND auth.uid() IS NOT NULL);