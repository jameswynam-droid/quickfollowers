
-- Clean up old pg_net HTTP response logs (these accumulate and eat storage/egress)
DELETE FROM net._http_response WHERE created < now() - interval '6 hours';

-- Create a scheduled cleanup function for pg_net logs
CREATE OR REPLACE FUNCTION public.cleanup_pg_net_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM net._http_response WHERE created < now() - interval '6 hours';
END;
$$;
