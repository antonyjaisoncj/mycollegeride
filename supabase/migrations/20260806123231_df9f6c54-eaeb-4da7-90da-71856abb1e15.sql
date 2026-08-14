CREATE POLICY "Students manage own photo folder"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'student-photos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'student-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins manage all student photos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'student-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'student-photos' AND public.has_role(auth.uid(), 'admin'::public.app_role));