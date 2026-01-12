-- Change reference_id from UUID to TEXT to support Kora Pay references
ALTER TABLE public.transactions 
ALTER COLUMN reference_id TYPE TEXT USING reference_id::TEXT;