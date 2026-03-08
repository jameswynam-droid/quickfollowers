-- Allow homepage visitors (anon) to read services so cards don't show "Services coming soon"
DROP POLICY IF EXISTS "Public can view services" ON public.services;

CREATE POLICY "Public can view services"
ON public.services
FOR SELECT
TO anon, authenticated
USING (true);