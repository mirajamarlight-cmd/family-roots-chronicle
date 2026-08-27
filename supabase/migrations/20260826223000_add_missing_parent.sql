-- Allow adding a parent who is not on the tree yet (including someone who has passed).

ALTER TABLE public.person_submissions
  ADD COLUMN IF NOT EXISTS added_parent_first_name TEXT,
  ADD COLUMN IF NOT EXISTS added_parent_middle_name TEXT,
  ADD COLUMN IF NOT EXISTS added_parent_last_name TEXT,
  ADD COLUMN IF NOT EXISTS added_parent_birth_date DATE,
  ADD COLUMN IF NOT EXISTS added_parent_death_date DATE,
  ADD COLUMN IF NOT EXISTS added_parent_of UUID REFERENCES public.people(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS other_parent_first_name TEXT,
  ADD COLUMN IF NOT EXISTS other_parent_middle_name TEXT,
  ADD COLUMN IF NOT EXISTS other_parent_last_name TEXT,
  ADD COLUMN IF NOT EXISTS other_parent_birth_date DATE,
  ADD COLUMN IF NOT EXISTS other_parent_death_date DATE;

ALTER TABLE public.person_submissions DROP CONSTRAINT IF EXISTS new_has_parent;
ALTER TABLE public.person_submissions DROP CONSTRAINT IF EXISTS person_submissions_new_has_parent;

ALTER TABLE public.person_submissions ADD CONSTRAINT new_has_family_link CHECK (
  kind <> 'new'
  OR parent_id IS NOT NULL
  OR (added_parent_first_name IS NOT NULL AND added_parent_of IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.person_submissions_before_insert()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
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
  IF NEW.first_name = '' OR NEW.address = '' OR NEW.phone = '' OR NEW.email = '' OR NEW.email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Name, birthday, address, phone, and email are required';
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
    IF NEW.added_parent_first_name IS NULL THEN
      NEW.parent_id := NULL;
      NEW.added_parent_of := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_submission(_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.person_submissions%ROWTYPE;
  v_person_id UUID;
  v_display TEXT;
  v_notes TEXT;
  v_existing_claim_user UUID;
  v_link_parent_id UUID;
  v_added_id UUID;
  v_other_id UUID;
  v_added_display TEXT;
  v_other_display TEXT;
  v_link_gender TEXT;
  v_other_gender TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO s FROM public.person_submissions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF s.status <> 'pending' THEN RAISE EXCEPTION 'Submission is not pending'; END IF;

  v_display := trim(concat_ws(' ', s.first_name, s.middle_name, s.last_name));
  v_notes := s.notes;
  IF s.kind = 'new' AND s.other_parent_name IS NOT NULL AND s.other_parent_first_name IS NULL THEN
    v_notes := NULLIF(trim(concat_ws(E'\n', v_notes, 'Other parent: ' || s.other_parent_name)), '');
  END IF;

  v_link_gender := CASE WHEN s.link_side = 'father' THEN 'male' WHEN s.link_side = 'mother' THEN 'female' ELSE NULL END;
  v_other_gender := CASE WHEN s.link_side = 'father' THEN 'female' WHEN s.link_side = 'mother' THEN 'male' ELSE NULL END;

  IF s.kind = 'new' THEN
    IF EXISTS (SELECT 1 FROM public.person_claims WHERE user_id = s.user_id) THEN
      RAISE EXCEPTION 'This account already has a family record';
    END IF;

    v_link_parent_id := s.parent_id;
    IF v_link_parent_id IS NULL THEN
      IF s.added_parent_first_name IS NULL OR s.added_parent_of IS NULL THEN
        RAISE EXCEPTION 'Root-family parent is missing';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = s.added_parent_of) THEN
        RAISE EXCEPTION 'The listed relative for that parent is missing';
      END IF;
      v_added_display := trim(concat_ws(' ', s.added_parent_first_name, s.added_parent_middle_name, s.added_parent_last_name));
      INSERT INTO public.people (
        first_name, middle_name, last_name, display_name, gender, birth_date, death_date
      ) VALUES (
        s.added_parent_first_name, s.added_parent_middle_name, s.added_parent_last_name,
        v_added_display, v_link_gender, s.added_parent_birth_date, s.added_parent_death_date
      ) RETURNING id INTO v_link_parent_id;
      INSERT INTO public.parent_child (parent_id, child_id, relationship_type)
      VALUES (s.added_parent_of, v_link_parent_id, 'biological');
    ELSIF NOT EXISTS (SELECT 1 FROM public.people WHERE id = v_link_parent_id) THEN
      RAISE EXCEPTION 'Root-family parent is missing';
    END IF;

    INSERT INTO public.people (first_name, middle_name, last_name, display_name, birth_date, notes)
    VALUES (s.first_name, s.middle_name, s.last_name, v_display, s.birth_date, v_notes)
    RETURNING id INTO v_person_id;

    INSERT INTO public.parent_child (parent_id, child_id, relationship_type)
    VALUES (v_link_parent_id, v_person_id, 'biological');

    IF s.other_parent_first_name IS NOT NULL THEN
      v_other_display := trim(concat_ws(' ', s.other_parent_first_name, s.other_parent_middle_name, s.other_parent_last_name));
      INSERT INTO public.people (
        first_name, middle_name, last_name, display_name, gender, birth_date, death_date
      ) VALUES (
        s.other_parent_first_name, s.other_parent_middle_name, s.other_parent_last_name,
        v_other_display, v_other_gender, s.other_parent_birth_date, s.other_parent_death_date
      ) RETURNING id INTO v_other_id;
      INSERT INTO public.parent_child (parent_id, child_id, relationship_type)
      VALUES (v_other_id, v_person_id, 'biological');
    END IF;

    INSERT INTO public.person_claims (user_id, person_id, address, phone, email)
    VALUES (s.user_id, v_person_id, s.address, s.phone, s.email);
  ELSE
    v_person_id := s.person_id;
    IF v_person_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.people WHERE id = v_person_id) THEN
      RAISE EXCEPTION 'Person not found';
    END IF;

    SELECT user_id INTO v_existing_claim_user FROM public.person_claims WHERE person_id = v_person_id;
    IF v_existing_claim_user IS NOT NULL AND v_existing_claim_user <> s.user_id THEN
      RAISE EXCEPTION 'That person is already claimed';
    END IF;
    IF EXISTS (SELECT 1 FROM public.person_claims WHERE user_id = s.user_id AND person_id <> v_person_id) THEN
      RAISE EXCEPTION 'This account already has a family record';
    END IF;

    UPDATE public.people SET
      first_name = s.first_name,
      middle_name = s.middle_name,
      last_name = s.last_name,
      display_name = v_display,
      birth_date = s.birth_date,
      notes = v_notes
    WHERE id = v_person_id;

    IF s.added_parent_first_name IS NOT NULL THEN
      v_added_display := trim(concat_ws(' ', s.added_parent_first_name, s.added_parent_middle_name, s.added_parent_last_name));
      INSERT INTO public.people (
        first_name, middle_name, last_name, display_name, gender, birth_date, death_date
      ) VALUES (
        s.added_parent_first_name, s.added_parent_middle_name, s.added_parent_last_name,
        v_added_display, v_link_gender, s.added_parent_birth_date, s.added_parent_death_date
      ) RETURNING id INTO v_added_id;
      IF s.added_parent_of IS NOT NULL THEN
        INSERT INTO public.parent_child (parent_id, child_id, relationship_type)
        VALUES (s.added_parent_of, v_added_id, 'biological');
      END IF;
      INSERT INTO public.parent_child (parent_id, child_id, relationship_type)
      VALUES (v_added_id, v_person_id, 'biological');
    END IF;

    INSERT INTO public.person_claims (user_id, person_id, address, phone, email)
    VALUES (s.user_id, v_person_id, s.address, s.phone, s.email)
    ON CONFLICT (user_id) DO UPDATE SET
      person_id = EXCLUDED.person_id,
      address = EXCLUDED.address,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email;
  END IF;

  UPDATE public.person_submissions
  SET status = 'approved', person_id = v_person_id, reviewed_at = now()
  WHERE id = s.id;

  RETURN v_person_id;
END;
$$;
