-- Enable realtime for orders table so users can see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;