INSERT INTO public.user_roles (user_id, role)
SELECT id, 'support'::public.app_role
FROM auth.users
WHERE lower(email) = 'support@quickfollowers.online'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.saved_replies
SET body = 'Hi, thanks for reaching out. We have escalated your speed request to the technical team for review. If the order is already In Progress, the delivery pace is controlled by the processing system and may still follow the estimated window. Please avoid placing duplicate orders on the same link.',
    updated_at = now()
WHERE title = 'Order speed-up request';

UPDATE public.saved_replies
SET body = 'Hi, unfortunately orders that are already In Progress cannot be cancelled or refunded, as work has already begun. Only Pending orders may be cancellable. If your order was placed within the last few minutes and has not started, share the order ID and we will check.',
    updated_at = now()
WHERE title = 'Cancellation not possible';

DROP POLICY IF EXISTS "Admins insert own totp" ON public.admin_totp;
CREATE POLICY "Staff insert own totp"
ON public.admin_totp
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'support'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admins update own totp" ON public.admin_totp;
CREATE POLICY "Staff update own totp"
ON public.admin_totp
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'support'::public.app_role)
  )
);

DROP POLICY IF EXISTS "Admins delete own totp" ON public.admin_totp;
CREATE POLICY "Staff delete own totp"
ON public.admin_totp
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'support'::public.app_role)
  )
);