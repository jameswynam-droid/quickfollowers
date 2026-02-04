-- Create table for floating bell notifications (Services page)
CREATE TABLE public.floating_bell_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.floating_bell_notifications ENABLE ROW LEVEL SECURITY;

-- Anyone can read active notifications
CREATE POLICY "Anyone can read active floating bell notifications" 
  ON public.floating_bell_notifications 
  FOR SELECT 
  USING (is_active = true);

-- Admins can create floating bell notifications
CREATE POLICY "Admins can create floating bell notifications" 
  ON public.floating_bell_notifications 
  FOR INSERT 
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  ));

-- Admins can update floating bell notifications
CREATE POLICY "Admins can update floating bell notifications" 
  ON public.floating_bell_notifications 
  FOR UPDATE 
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  ));

-- Admins can delete floating bell notifications
CREATE POLICY "Admins can delete floating bell notifications" 
  ON public.floating_bell_notifications 
  FOR DELETE 
  USING (EXISTS (
    SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'
  ));

-- Add updated_at trigger
CREATE TRIGGER update_floating_bell_notifications_updated_at
  BEFORE UPDATE ON public.floating_bell_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.floating_bell_notifications;