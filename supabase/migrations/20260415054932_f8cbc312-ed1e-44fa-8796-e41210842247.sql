
-- Unique partial index to prevent duplicate deposit transactions
CREATE UNIQUE INDEX IF NOT EXISTS unique_deposit_per_reference
ON public.transactions (reference_id)
WHERE type = 'deposit' AND reference_id IS NOT NULL;

-- Atomic deposit function: inserts transaction + updates balance in one step
CREATE OR REPLACE FUNCTION public.process_deposit(
  p_reference_id TEXT,
  p_user_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
  v_inserted BOOLEAN := FALSE;
  v_desc TEXT;
BEGIN
  v_desc := COALESCE(p_description, p_payment_method || ' deposit');

  BEGIN
    INSERT INTO public.transactions (user_id, type, amount, balance_after, description, reference_id, payment_method)
    VALUES (p_user_id, 'deposit', p_amount, 0, v_desc, p_reference_id, p_payment_method);
    v_inserted := TRUE;
  EXCEPTION WHEN unique_violation THEN
    v_inserted := FALSE;
  END;

  IF NOT v_inserted THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_processed');
  END IF;

  UPDATE public.profiles
  SET balance = balance + p_amount
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  UPDATE public.transactions
  SET balance_after = v_new_balance
  WHERE reference_id = p_reference_id AND type = 'deposit';

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
