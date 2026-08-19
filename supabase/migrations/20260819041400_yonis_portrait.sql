-- Set the genealogical root Yonis portrait (static asset in /public).
UPDATE public.people
SET photo_url = '/yonis.png'
WHERE display_name = 'Yonis'
  AND id NOT IN (SELECT child_id FROM public.parent_child);
