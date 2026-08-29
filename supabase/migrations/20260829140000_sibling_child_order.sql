ALTER TABLE public.parent_child
  ADD COLUMN IF NOT EXISTS child_order SMALLINT;

COMMENT ON COLUMN public.parent_child.child_order IS
  'Manual birth order among siblings when birth_date is unknown; lower comes first.';
