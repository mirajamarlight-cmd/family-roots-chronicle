UPDATE public.people
SET gender = 'male'
WHERE gender IS NULL OR btrim(gender) = '';

ALTER TABLE public.people
  ALTER COLUMN gender SET DEFAULT 'male';
