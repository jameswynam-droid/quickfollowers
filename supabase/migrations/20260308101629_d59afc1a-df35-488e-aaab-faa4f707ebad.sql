-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can read active floating bell notifications" ON public.floating_bell_notifications;

-- Create a new policy requiring authentication
CREATE POLICY "Authenticated users can read active floating bell notifications"
ON public.floating_bell_notifications
FOR SELECT
TO authenticated
USING (is_active = true);

-- Also secure bell_notifications table
DROP POLICY IF EXISTS "Anyone can read active bell notifications" ON public.bell_notifications;

CREATE POLICY "Authenticated users can read active bell notifications"
ON public.bell_notifications
FOR SELECT
TO authenticated
USING (is_active = true);

-- Also secure notifications table  
DROP POLICY IF EXISTS "Anyone can read active notifications" ON public.notifications;

CREATE POLICY "Authenticated users can read active notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));