
-- Create a function that sends webhook to sync-to-external edge function
CREATE OR REPLACE FUNCTION public.notify_external_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payload jsonb;
  edge_function_url text;
BEGIN
  edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-to-external';
  
  -- Build payload
  payload := jsonb_build_object(
    'event', TG_OP,
    'table', TG_TABLE_NAME,
    'record', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW)::jsonb END,
    'old_record', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD)::jsonb END
  );

  -- Use pg_net to make async HTTP call
  PERFORM net.http_post(
    url := 'https://ckradhwidegrbmdiynts.supabase.co/functions/v1/sync-to-external',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers on all synced tables
CREATE TRIGGER sync_profiles_to_external
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.notify_external_sync();

CREATE TRIGGER sync_services_to_external
AFTER INSERT OR UPDATE OR DELETE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.notify_external_sync();

CREATE TRIGGER sync_orders_to_external
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_external_sync();

CREATE TRIGGER sync_transactions_to_external
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.notify_external_sync();

CREATE TRIGGER sync_payments_to_external
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.notify_external_sync();

CREATE TRIGGER sync_tickets_to_external
AFTER INSERT OR UPDATE OR DELETE ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.notify_external_sync();
