
-- 1. Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

-- Create unique index for case-insensitive username uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles (lower(username));

-- 2. Add ticket_reads table for tracking unread messages
CREATE TABLE IF NOT EXISTS public.ticket_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  last_read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, ticket_id)
);

ALTER TABLE public.ticket_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ticket reads"
  ON public.ticket_reads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ticket reads"
  ON public.ticket_reads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ticket reads"
  ON public.ticket_reads FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Add payment_method and short_id to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS short_id text;

-- 4. Update handle_new_user trigger to include username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'username'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$function$;

-- 5. Function to generate 4-digit short ID for transactions
CREATE OR REPLACE FUNCTION public.generate_short_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_short_id text;
BEGIN
  IF NEW.short_id IS NULL THEN
    new_short_id := lpad(floor(random() * 10000)::text, 4, '0');
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.transactions WHERE short_id = new_short_id) LOOP
      new_short_id := lpad(floor(random() * 10000)::text, 4, '0');
    END LOOP;
    NEW.short_id := new_short_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE TRIGGER generate_transaction_short_id
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_short_id();

-- 6. Function to check username availability (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.check_username_available(requested_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(requested_username)
  )
$function$;
