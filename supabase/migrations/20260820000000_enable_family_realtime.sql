-- Enable Supabase Realtime for family graph tables.
ALTER PUBLICATION supabase_realtime ADD TABLE public.people;
ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_child;
