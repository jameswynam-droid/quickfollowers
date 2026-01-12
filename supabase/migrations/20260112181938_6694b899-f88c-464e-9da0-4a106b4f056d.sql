-- Add unique constraint to prevent duplicate refunds for the same order
-- This ensures only one refund transaction can exist per order
CREATE UNIQUE INDEX IF NOT EXISTS unique_refund_per_order 
ON public.transactions (reference_id) 
WHERE type = 'refund' AND reference_id IS NOT NULL;