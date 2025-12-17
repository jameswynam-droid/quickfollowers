-- Create table to track pending email changes
CREATE TABLE public.pending_email_changes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_email TEXT NOT NULL,
  new_email TEXT NOT NULL,
  confirmation_token TEXT NOT NULL UNIQUE,
  old_email_confirmed BOOLEAN NOT NULL DEFAULT false,
  new_email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.pending_email_changes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own pending email changes"
ON public.pending_email_changes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending email changes"
ON public.pending_email_changes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending email changes"
ON public.pending_email_changes
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_pending_email_changes_token ON public.pending_email_changes(confirmation_token);
CREATE INDEX idx_pending_email_changes_user ON public.pending_email_changes(user_id);