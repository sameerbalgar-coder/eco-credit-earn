DROP POLICY IF EXISTS "Signed-in users can view report photos" ON storage.objects;
CREATE POLICY "Owners and staff can list report photos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'report-photos' AND (owner_id = (select auth.uid()::text) OR (storage.foldername(name))[1] = (select auth.uid()::text)
  OR public.has_role(auth.uid(),'worker') OR public.has_role(auth.uid(),'supervisor') OR public.has_role(auth.uid(),'admin')));