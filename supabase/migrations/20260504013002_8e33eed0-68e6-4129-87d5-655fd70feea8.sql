
-- Lock down SECURITY DEFINER function execution to service_role only for internal/trigger functions.
-- Trigger functions still execute correctly because triggers run with table owner privileges.

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_pg_net_logs() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_short_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_external_sync() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_deposit(text, uuid, numeric, text, text) FROM PUBLIC, anon, authenticated;

-- has_role is used in RLS policies; ensure authenticated can still execute it (RLS internally is fine but explicit grant is safest)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

-- check_username_available is called from the public sign-up flow; allow anon + authenticated
REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;

-- Restrict public storage buckets so listing/enumeration is blocked. Direct URL access still works.
DROP POLICY IF EXISTS "Public read access to ticket-attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to popup-images" ON storage.objects;

-- Ticket attachments: only ticket owner or admin can read via API
CREATE POLICY "Ticket attachments owner or admin read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ticket-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "Ticket attachments owner upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ticket-attachments'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- Popup images: signed-in users can read; only admins upload
CREATE POLICY "Popup images authenticated read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'popup-images');

CREATE POLICY "Popup images admin write"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'popup-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Popup images admin delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'popup-images'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);
