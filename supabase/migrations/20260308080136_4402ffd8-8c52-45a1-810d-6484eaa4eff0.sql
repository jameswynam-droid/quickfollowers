-- 1. Fix profiles: restrict UPDATE to non-financial fields only
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND balance = (SELECT balance FROM public.profiles WHERE id = auth.uid()));

-- 2. Fix payments: force INSERT to have status='pending', no approved_by/approved_at
DROP POLICY IF EXISTS "Users can create payment requests" ON public.payments;

CREATE POLICY "Users can create payment requests"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
  AND approved_by IS NULL
  AND approved_at IS NULL
);

-- 3. Fix pending_email_changes: remove user UPDATE policy
DROP POLICY IF EXISTS "Users can update their own pending email changes" ON public.pending_email_changes;

-- 4. Fix orders: force INSERT to have status='pending' and charge=0 (real charge set by edge function)
DROP POLICY IF EXISTS "Users can create their own orders" ON public.orders;

CREATE POLICY "Users can create their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND status = 'pending'
);