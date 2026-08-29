-- Reject join submissions when the person or account is already linked.

CREATE OR REPLACE FUNCTION public.person_submissions_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim_user UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first'; END IF;
  NEW.user_id := auth.uid();
  NEW.status := 'pending';
  NEW.reviewed_at := NULL;
  NEW.first_name := trim(NEW.first_name);
  NEW.middle_name := NULLIF(trim(NEW.middle_name), '');
  NEW.last_name := NULLIF(trim(NEW.last_name), '');
  NEW.address := trim(NEW.address);
  NEW.phone := trim(NEW.phone);
  NEW.email := trim(NEW.email);
  NEW.notes := NULLIF(trim(NEW.notes), '');
  NEW.other_parent_name := NULLIF(trim(NEW.other_parent_name), '');
  NEW.added_parent_first_name := NULLIF(trim(NEW.added_parent_first_name), '');
  NEW.added_parent_middle_name := NULLIF(trim(NEW.added_parent_middle_name), '');
  NEW.added_parent_last_name := NULLIF(trim(NEW.added_parent_last_name), '');
  NEW.other_parent_first_name := NULLIF(trim(NEW.other_parent_first_name), '');
  NEW.other_parent_middle_name := NULLIF(trim(NEW.other_parent_middle_name), '');
  NEW.other_parent_last_name := NULLIF(trim(NEW.other_parent_last_name), '');
  IF NEW.first_name = '' OR NEW.address = '' OR NEW.phone = '' OR NEW.email = ''
    OR NEW.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN
    RAISE EXCEPTION 'Name, birthday, address, phone, and email are required';
  END IF;
  IF NEW.birth_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Birthday cannot be in the future';
  END IF;

  IF EXISTS (SELECT 1 FROM public.person_claims WHERE user_id = auth.uid()) AND NEW.kind = 'new' THEN
    RAISE EXCEPTION 'This account already has a family record';
  END IF;

  IF NEW.kind = 'new' THEN
    NEW.person_id := NULL;
    IF NEW.link_side IS NULL THEN RAISE EXCEPTION 'Choose father or mother as your link'; END IF;
    IF NEW.parent_id IS NULL AND (NEW.added_parent_first_name IS NULL OR NEW.added_parent_of IS NULL) THEN
      RAISE EXCEPTION 'Pick a parent on the tree, or add them under someone already listed';
    END IF;
    IF NEW.parent_id IS NOT NULL THEN
      NEW.added_parent_first_name := NULL;
      NEW.added_parent_middle_name := NULL;
      NEW.added_parent_last_name := NULL;
      NEW.added_parent_birth_date := NULL;
      NEW.added_parent_death_date := NULL;
      NEW.added_parent_of := NULL;
    END IF;
  ELSE
    IF NEW.person_id IS NULL THEN RAISE EXCEPTION 'Pick yourself from the tree first'; END IF;

    SELECT user_id INTO v_claim_user FROM public.person_claims WHERE person_id = NEW.person_id;
    IF v_claim_user IS NOT NULL AND v_claim_user <> auth.uid() THEN
      RAISE EXCEPTION 'That person is already linked to another account';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.person_claims
      WHERE user_id = auth.uid() AND person_id <> NEW.person_id
    ) THEN
      RAISE EXCEPTION 'This account already has a family record';
    END IF;

    IF NEW.added_parent_first_name IS NULL THEN
      NEW.parent_id := NULL;
      NEW.added_parent_of := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
