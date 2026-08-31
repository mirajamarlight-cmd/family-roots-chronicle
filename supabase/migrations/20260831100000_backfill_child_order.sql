-- Backfill missing sibling birth order (legacy rows before child_order was set).
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY parent_id
      ORDER BY child_order NULLS LAST, created_at, child_id
    ) AS rn
  FROM public.parent_child
  WHERE child_order IS NULL
)
UPDATE public.parent_child AS pc
SET child_order = ranked.rn
FROM ranked
WHERE pc.id = ranked.id;
