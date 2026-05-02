-- Create popup-images storage bucket (public read)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('popup-images', 'popup-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Popup images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'popup-images');

-- Only admins can upload
CREATE POLICY "Admins can upload popup images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'popup-images' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update popup images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'popup-images' AND public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete popup images"
ON storage.objects FOR DELETE
USING (bucket_id = 'popup-images' AND public.has_role(auth.uid(), 'admin'));