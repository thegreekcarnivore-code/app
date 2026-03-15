DROP POLICY IF EXISTS "Users can upload progress photos" ON storage.objects;

CREATE POLICY "Users can upload progress photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'progress-photos'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);