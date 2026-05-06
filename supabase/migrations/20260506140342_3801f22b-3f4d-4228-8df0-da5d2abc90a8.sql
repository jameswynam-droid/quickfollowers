
-- Make ticket-attachments private
UPDATE storage.buckets SET public = false, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/jpg','image/gif','image/webp','application/pdf']
WHERE id = 'ticket-attachments';

-- Drop any existing policies on ticket-attachments to redefine cleanly
DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects'
    AND policyname ILIKE '%ticket%attachment%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Users can upload to their own folder
CREATE POLICY "ticket_attachments_user_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can read their own attachments
CREATE POLICY "ticket_attachments_user_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can read all attachments
CREATE POLICY "ticket_attachments_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'ticket-attachments'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
