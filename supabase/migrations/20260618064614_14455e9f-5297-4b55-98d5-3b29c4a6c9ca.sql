
-- 1. Add reserved_balance to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reserved_balance numeric NOT NULL DEFAULT 0;

-- 2. Add description column to services (if not already present)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS description text;

-- 3. subscription_reservations table
CREATE TABLE IF NOT EXISTS public.subscription_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  api_subscription_id text,
  estimated_max numeric NOT NULL,
  charged_so_far numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active', -- active | completed | cancelled | expired
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_reservations TO authenticated;
GRANT ALL ON public.subscription_reservations TO service_role;

ALTER TABLE public.subscription_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own reservations" ON public.subscription_reservations;
CREATE POLICY "Users view own reservations"
  ON public.subscription_reservations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all reservations" ON public.subscription_reservations;
CREATE POLICY "Admins view all reservations"
  ON public.subscription_reservations FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_sub_reservations_updated_at ON public.subscription_reservations;
CREATE TRIGGER trg_sub_reservations_updated_at
  BEFORE UPDATE ON public.subscription_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_sub_reservations_user_status
  ON public.subscription_reservations (user_id, status);

-- 4. Daily service sync via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing job if present, then schedule fresh
DO $$
BEGIN
  PERFORM cron.unschedule('daily-sync-services');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'daily-sync-services',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ckradhwidegrbmdiynts.supabase.co/functions/v1/sync-services',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrcmFkaHdpZGVncmJtZGl5bnRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NTc1OTMsImV4cCI6MjA3NTQzMzU5M30.Etl2YREK219qQTrxD7t8pKp475I12hCvmFrkgkMkrcE'
    ),
    body := jsonb_build_object('trigger', 'daily-cron')
  ) AS request_id;
  $$
);
