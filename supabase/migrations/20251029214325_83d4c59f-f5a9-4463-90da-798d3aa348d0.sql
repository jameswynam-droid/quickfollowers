-- Add provider column to services table
ALTER TABLE public.services 
ADD COLUMN provider text NOT NULL DEFAULT 'owlet';

-- Add index for better query performance
CREATE INDEX idx_services_provider ON public.services(provider);

-- Add comment
COMMENT ON COLUMN public.services.provider IS 'SMM provider source (owlet, followspanel)';