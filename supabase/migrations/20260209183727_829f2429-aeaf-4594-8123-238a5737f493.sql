-- Add failure_reason column to orders table
ALTER TABLE public.orders ADD COLUMN failure_reason TEXT DEFAULT NULL;