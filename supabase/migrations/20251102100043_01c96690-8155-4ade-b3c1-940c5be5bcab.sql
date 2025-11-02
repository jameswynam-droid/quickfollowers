-- Change services id column from integer to text to support multiple providers
-- First drop the foreign key constraint from orders table
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_service_id_fkey;

-- Change the service_id column in orders to text
ALTER TABLE public.orders ALTER COLUMN service_id TYPE text;

-- Now change the services id column to text
ALTER TABLE public.services DROP CONSTRAINT services_pkey;
ALTER TABLE public.services ALTER COLUMN id TYPE text USING id::text;
ALTER TABLE public.services ADD PRIMARY KEY (id);

-- Recreate the foreign key constraint
ALTER TABLE public.orders 
  ADD CONSTRAINT orders_service_id_fkey 
  FOREIGN KEY (service_id) 
  REFERENCES public.services(id);