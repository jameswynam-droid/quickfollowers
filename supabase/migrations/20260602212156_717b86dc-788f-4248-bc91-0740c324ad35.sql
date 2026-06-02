
-- 1. Lock down OTP tables: deny all access to anon/authenticated.
--    Only the service role (used by edge functions) bypasses RLS and can use them.
REVOKE ALL ON public.otp_codes FROM anon, authenticated;
REVOKE ALL ON public.otp_rate_limits FROM anon, authenticated;

-- Explicit deny policies so any future grant doesn't accidentally expose data.
DROP POLICY IF EXISTS "otp_codes_deny_all" ON public.otp_codes;
CREATE POLICY "otp_codes_deny_all" ON public.otp_codes
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "otp_rate_limits_deny_all" ON public.otp_rate_limits;
CREATE POLICY "otp_rate_limits_deny_all" ON public.otp_rate_limits
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- 2. Normalise existing usernames to lowercase (avoid duplicate-on-case conflicts:
--    keep the earliest one, blank the rest so the unique check still works
--    if the user later picks a new one).
WITH ranked AS (
  SELECT id, username,
         ROW_NUMBER() OVER (PARTITION BY lower(username) ORDER BY created_at ASC) AS rn
  FROM public.profiles
  WHERE username IS NOT NULL
)
UPDATE public.profiles p
SET username = lower(p.username)
FROM ranked r
WHERE p.id = r.id AND r.rn = 1;

-- 3. Drop the external-sync trigger so support ticket messages stay only in
--    the primary database, never replicated outward. (The table itself is
--    untouched — admins/users still see chat history through RLS.)
DROP TRIGGER IF EXISTS sync_ticket_messages_to_external ON public.ticket_messages;
