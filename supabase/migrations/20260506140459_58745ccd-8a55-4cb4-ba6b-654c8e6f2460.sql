
CREATE POLICY "ticket_attachments_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-attachments'
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );
