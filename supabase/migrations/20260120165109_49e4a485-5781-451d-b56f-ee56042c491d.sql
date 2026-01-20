-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket_messages table
CREATE TABLE public.ticket_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  attachment_url TEXT,
  attachment_name TEXT,
  is_admin_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tickets
-- Users can view their own tickets
CREATE POLICY "Users can view their own tickets"
ON public.tickets FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
ON public.tickets FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Users can create their own tickets
CREATE POLICY "Users can create their own tickets"
ON public.tickets FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can update any ticket
CREATE POLICY "Admins can update any ticket"
ON public.tickets FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Users can update their own tickets (for closing)
CREATE POLICY "Users can update their own tickets"
ON public.tickets FOR UPDATE
USING (auth.uid() = user_id);

-- RLS Policies for ticket_messages
-- Users can view messages in their own tickets
CREATE POLICY "Users can view messages in their tickets"
ON public.ticket_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tickets t 
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
);

-- Admins can view all messages
CREATE POLICY "Admins can view all messages"
ON public.ticket_messages FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Users can create messages in their own tickets
CREATE POLICY "Users can create messages in their tickets"
ON public.ticket_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  EXISTS (
    SELECT 1 FROM public.tickets t 
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
);

-- Admins can create messages in any ticket
CREATE POLICY "Admins can create messages in any ticket"
ON public.ticket_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND
  public.has_role(auth.uid(), 'admin')
);

-- Create storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments',
  'ticket-attachments',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
);

-- Storage policies for ticket attachments
CREATE POLICY "Authenticated users can upload ticket attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view ticket attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-attachments');

-- Create updated_at trigger for tickets
CREATE TRIGGER update_tickets_updated_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();