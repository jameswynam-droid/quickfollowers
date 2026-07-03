
-- TOTP: track last verified time
ALTER TABLE public.admin_totp ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

-- Tickets: last_message_at
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;
UPDATE public.tickets t
SET last_message_at = COALESCE(
  (SELECT MAX(created_at) FROM public.ticket_messages m WHERE m.ticket_id = t.id),
  t.created_at
)
WHERE last_message_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_last_message_at ON public.tickets(last_message_at DESC);

CREATE OR REPLACE FUNCTION public.bump_ticket_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.tickets SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_ticket_last_message ON public.ticket_messages;
CREATE TRIGGER trg_bump_ticket_last_message
AFTER INSERT ON public.ticket_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_ticket_last_message();

-- Support role policies
DROP POLICY IF EXISTS "Support can view all profiles" ON public.profiles;
CREATE POLICY "Support can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Support can view all tickets" ON public.tickets;
CREATE POLICY "Support can view all tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Support can update tickets" ON public.tickets;
CREATE POLICY "Support can update tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Support can view all messages" ON public.ticket_messages;
CREATE POLICY "Support can view all messages" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Support can insert messages" ON public.ticket_messages;
CREATE POLICY "Support can insert messages" ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Support can view all transactions" ON public.transactions;
CREATE POLICY "Support can view all transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Support can view all orders" ON public.orders;
CREATE POLICY "Support can view all orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Support can view all payments" ON public.payments;
CREATE POLICY "Support can view all payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Support can view saved replies" ON public.saved_replies;
CREATE POLICY "Support can view saved replies" ON public.saved_replies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'support'::public.app_role) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Blog categories: authenticated only
REVOKE SELECT ON public.blog_categories FROM anon;
DROP POLICY IF EXISTS "Anyone can view categories" ON public.blog_categories;
DROP POLICY IF EXISTS "Public read blog categories" ON public.blog_categories;
DROP POLICY IF EXISTS "Authenticated read blog categories" ON public.blog_categories;
CREATE POLICY "Authenticated read blog categories" ON public.blog_categories
  FOR SELECT TO authenticated USING (true);

-- Seed default saved replies (only if empty)
INSERT INTO public.saved_replies (title, body, created_by)
SELECT v.title, v.body, (SELECT id FROM auth.users WHERE email = 'admin@quickfollowers.online' LIMIT 1)
FROM (VALUES
  ('Order speed-up request',
   'Hi, thanks for reaching out. Orders that have already started processing cannot be sped up on our side — delivery speed is set by the provider once the order enters "In Progress". It will complete within its estimated window. Please avoid placing duplicate orders on the same link.'),
  ('Cancellation not possible',
   'Hi, unfortunately orders that are already "In Progress" cannot be cancelled or refunded, as work has already begun. Only "Pending" orders may be cancellable. If your order was placed within the last few minutes and has not started, share the order ID and we will check.'),
  ('Drip-feed explanation',
   'Hi, with drip-feed your total quantity is split into smaller runs over time (for example 1000 likes delivered as 100 x 10 runs). The full amount is reserved from your balance upfront and each run pulls from that reservation. This looks more natural than a single burst.'),
  ('Refill request',
   'Hi, please share the affected order ID and today''s current count on the post. If drops are within the refill window and the service supports refill, we will submit a refill for you. Refill is not available on every service.'),
  ('Refund policy',
   'Hi, refunds are issued automatically for the undelivered portion when an order is marked "Partial" or "Cancelled". The refunded amount returns to your account balance and appears in Transaction History with the original order ID.'),
  ('Welcome / getting started',
   'Welcome! To place your first order: (1) Add funds under "Add Funds", (2) go to "Services" and pick the category/platform, (3) paste your public link and enter the quantity. If your account is private, switch it to public before ordering. Let us know if you get stuck.')
) AS v(title, body)
WHERE NOT EXISTS (SELECT 1 FROM public.saved_replies LIMIT 1);
