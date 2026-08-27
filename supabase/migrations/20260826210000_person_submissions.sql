-- Relatives submit themselves; nothing hits the public tree until an admin approves.

CREATE TABLE public.person_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('new', 'edit')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  link_side TEXT CHECK (link_side IS NULL OR link_side IN ('father', 'mother')),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT,
  birth_date DATE NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  notes TEXT,
  other_parent_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT edit_has_person CHECK (kind <> 'edit' OR person_id IS NOT NULL),
  CONSTRAINT new_has_parent CHECK (kind <> 'new' OR parent_id IS NOT NULL),
  CONSTRAINT new_has_link_side CHECK (kind <> 'new' OR link_side IN ('father', 'mother'))
);
GRANT SELECT, INSERT ON public.person_submissions TO authenticated;
GRANT ALL ON public.person_submissions TO service_role;
ALTER TABLE public.person_submissions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX one_pending_submission_per_user
  ON public.person_submissions (user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX one_pending_edit_per_person
  ON public.person_submissions (person_id) WHERE status = 'pending' AND kind = 'edit';
CREATE INDEX idx_person_submissions_status ON public.person_submissions (status);

CREATE TABLE public.person_claims (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL UNIQUE REFERENCES public.people(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.person_claims TO authenticated;
GRANT ALL ON public.person_claims TO service_role;
ALTER TABLE public.person_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own submissions, admins read all"
  ON public.person_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Signed-in users submit their own record"
  ON public.person_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Users read own claims, admins read all"
  ON public.person_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

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
  IF NEW.first_name = '' OR NEW.address = '' OR NEW.phone = '' OR NEW.email = '' OR NEW.email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Name, birthday, address, phone, and email are required';
  END IF;
  IF NEW.kind = 'new' THEN
    NEW.person_id := NULL;
    IF NEW.parent_id IS NULL THEN RAISE EXCEPTION 'Root-family parent is required'; END IF;
    IF NEW.link_side IS NULL THEN RAISE EXCEPTION 'Choose father or mother as your link'; END IF;
  ELSE
    NEW.parent_id := NULL;
    NEW.link_side := NULL;
    NEW.other_parent_name := NULL;
    IF NEW.person_id IS NULL THEN RAISE EXCEPTION 'Pick yourself from the tree first'; END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER person_submissions_before_insert
  BEFORE INSERT ON public.person_submissions
  FOR EACH ROW EXECUTE FUNCTION public.person_submissions_before_insert();

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
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO s FROM public.person_submissions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
  IF s.status <> 'pending' THEN RAISE EXCEPTION 'Submission is not pending'; END IF;

  v_display := trim(concat_ws(' ', s.first_name, s.middle_name, s.last_name));
  v_notes := s.notes;
  IF s.kind = 'new' AND s.other_parent_name IS NOT NULL THEN
    v_notes := NULLIF(trim(concat_ws(E'\n', v_notes, 'Other parent: ' || s.other_parent_name)), '');
  END IF;

  IF s.kind = 'new' THEN
    IF s.parent_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.people WHERE id = s.parent_id) THEN
      RAISE EXCEPTION 'Root-family parent is missing';
    END IF;
    IF EXISTS (SELECT 1 FROM public.person_claims WHERE user_id = s.user_id) THEN
      RAISE EXCEPTION 'This account already has a family record';
    END IF;

    INSERT INTO public.people (first_name, middle_name, last_name, display_name, birth_date, notes)
    VALUES (s.first_name, s.middle_name, s.last_name, v_display, s.birth_date, v_notes)
    RETURNING id INTO v_person_id;

    INSERT INTO public.parent_child (parent_id, child_id, relationship_type)
    VALUES (s.parent_id, v_person_id, 'biological');

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

CREATE OR REPLACE FUNCTION public.reject_submission(_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.person_submissions
  SET status = 'rejected', reviewed_at = now()
  WHERE id = _id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission is not pending'; END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_submission(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_submission(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_submission(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_submission(UUID) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.person_submissions;
