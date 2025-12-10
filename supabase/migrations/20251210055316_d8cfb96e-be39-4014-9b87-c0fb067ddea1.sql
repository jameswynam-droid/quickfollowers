-- Fix 1: Remove the permissive transaction INSERT policy
DROP POLICY IF EXISTS "System can insert transactions" ON public.transactions;

-- Fix 2: Add balance non-negative constraint to prevent race condition overspending
ALTER TABLE public.profiles 
ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);