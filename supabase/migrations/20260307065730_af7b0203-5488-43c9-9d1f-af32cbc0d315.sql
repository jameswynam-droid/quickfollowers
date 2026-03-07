ALTER TABLE public.services ADD COLUMN IF NOT EXISTS dripfeed boolean DEFAULT false;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS average_time text DEFAULT null;