ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS parent_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_child_id text;

CREATE UNIQUE INDEX IF NOT EXISTS orders_provider_child_id_key ON public.orders(provider_child_id) WHERE provider_child_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_parent_order_id_idx ON public.orders(parent_order_id);

ALTER TABLE public.subscription_reservations
  ADD COLUMN IF NOT EXISTS released numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.internal_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  reply text,
  replied_by uuid,
  replied_at timestamptz,
  read_by_admin boolean NOT NULL DEFAULT false,
  read_by_sender boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.internal_messages TO authenticated;
GRANT ALL ON public.internal_messages TO service_role;

ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read internal messages"
ON public.internal_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE POLICY "Staff can create internal messages"
ON public.internal_messages FOR INSERT TO authenticated
WITH CHECK ((public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support')) AND sender_id = auth.uid());

CREATE POLICY "Staff can update internal messages"
ON public.internal_messages FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'support'));

CREATE TRIGGER internal_messages_updated_at
BEFORE UPDATE ON public.internal_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();