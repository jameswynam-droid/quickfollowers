-- Create bell_notifications table for longer notifications in the header bell
CREATE TABLE public.bell_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.bell_notifications ENABLE ROW LEVEL SECURITY;

-- Anyone can read active bell notifications
CREATE POLICY "Anyone can read active bell notifications"
ON public.bell_notifications
FOR SELECT
USING (is_active = true);

-- Admins can create bell notifications
CREATE POLICY "Admins can create bell notifications"
ON public.bell_notifications
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
));

-- Admins can update bell notifications
CREATE POLICY "Admins can update bell notifications"
ON public.bell_notifications
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
));

-- Admins can delete bell notifications
CREATE POLICY "Admins can delete bell notifications"
ON public.bell_notifications
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bell_notifications;

-- Create trigger for updated_at
CREATE TRIGGER update_bell_notifications_updated_at
BEFORE UPDATE ON public.bell_notifications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();