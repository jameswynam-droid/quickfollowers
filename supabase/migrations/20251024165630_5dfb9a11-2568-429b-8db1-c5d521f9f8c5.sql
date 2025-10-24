-- Increase rate column precision to handle larger values
ALTER TABLE public.services 
ALTER COLUMN rate TYPE numeric(15, 2);