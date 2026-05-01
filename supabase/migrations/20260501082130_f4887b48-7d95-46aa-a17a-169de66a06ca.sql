-- Add in_progress to the order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'in_progress';

-- Create daily_popups table
CREATE TABLE IF NOT EXISTS public.daily_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  primary_button_label text,
  primary_button_url text,
  primary_button_color text,
  secondary_button_label text,
  secondary_button_url text,
  secondary_button_color text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_popups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active popups"
  ON public.daily_popups FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can insert popups"
  ON public.daily_popups FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update popups"
  ON public.daily_popups FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete popups"
  ON public.daily_popups FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read all popups"
  ON public.daily_popups FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_daily_popups_updated_at
  BEFORE UPDATE ON public.daily_popups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lock down OTP tables (no public access; only service role via SECURITY DEFINER funcs / edge functions)
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;