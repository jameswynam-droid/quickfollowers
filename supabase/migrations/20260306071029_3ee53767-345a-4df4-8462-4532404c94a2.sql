-- Temporarily drop FK constraint to allow deleting services with existing orders
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_service_id_fkey;

-- Delete all followspanel services
DELETE FROM public.services WHERE provider = 'followspanel';

-- Re-add FK constraint as NOT VALID so existing orphan references are allowed
ALTER TABLE public.orders ADD CONSTRAINT orders_service_id_fkey 
  FOREIGN KEY (service_id) REFERENCES public.services(id) NOT VALID;