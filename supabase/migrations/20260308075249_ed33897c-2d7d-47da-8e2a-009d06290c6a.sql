-- Drop the overly permissive "Anyone can view services" policy
DROP POLICY IF EXISTS "Anyone can view services" ON public.services;

-- Create a new policy that only allows authenticated users to view services
CREATE POLICY "Authenticated users can view services"
ON public.services
FOR SELECT
TO authenticated
USING (true);