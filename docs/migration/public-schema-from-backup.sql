--
-- PostgreSQL database dump
--


-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: approve_submission(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_submission(_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: claim_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN FALSE; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
  RETURN TRUE;
END; $$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;


--
-- Name: person_submissions_before_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.person_submissions_before_insert() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
$_$;


--
-- Name: reject_submission(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reject_submission(_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: marriages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marriages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    person1_id uuid NOT NULL,
    person2_id uuid NOT NULL,
    marriage_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT marriages_check CHECK ((person1_id <> person2_id))
);


--
-- Name: parent_child; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_child (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    parent_id uuid NOT NULL,
    child_id uuid NOT NULL,
    relationship_type text DEFAULT 'biological'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    child_order smallint,
    CONSTRAINT parent_child_check CHECK ((parent_id <> child_id))
);


--
-- Name: COLUMN parent_child.child_order; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.parent_child.child_order IS 'Manual birth order among siblings when birth_date is unknown; lower comes first.';


--
-- Name: people; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.people (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    middle_name text,
    last_name text,
    display_name text NOT NULL,
    gender text DEFAULT 'male'::text,
    birth_date date,
    death_date date,
    photo_url text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_deceased boolean DEFAULT false NOT NULL
);


--
-- Name: person_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_claims (
    user_id uuid NOT NULL,
    person_id uuid NOT NULL,
    address text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: person_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    person_id uuid,
    parent_id uuid,
    link_side text,
    first_name text NOT NULL,
    middle_name text,
    last_name text,
    birth_date date NOT NULL,
    address text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    notes text,
    other_parent_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    added_parent_first_name text,
    added_parent_middle_name text,
    added_parent_last_name text,
    added_parent_birth_date date,
    added_parent_death_date date,
    added_parent_of uuid,
    other_parent_first_name text,
    other_parent_middle_name text,
    other_parent_last_name text,
    other_parent_birth_date date,
    other_parent_death_date date,
    CONSTRAINT edit_has_person CHECK (((kind <> 'edit'::text) OR (person_id IS NOT NULL))),
    CONSTRAINT new_has_family_link CHECK (((kind <> 'new'::text) OR (parent_id IS NOT NULL) OR ((added_parent_first_name IS NOT NULL) AND (added_parent_of IS NOT NULL)))),
    CONSTRAINT new_has_link_side CHECK (((kind <> 'new'::text) OR (link_side = ANY (ARRAY['father'::text, 'mother'::text])))),
    CONSTRAINT person_submissions_kind_check CHECK ((kind = ANY (ARRAY['new'::text, 'edit'::text]))),
    CONSTRAINT person_submissions_link_side_check CHECK (((link_side IS NULL) OR (link_side = ANY (ARRAY['father'::text, 'mother'::text])))),
    CONSTRAINT person_submissions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: marriages marriages_person1_id_person2_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marriages
    ADD CONSTRAINT marriages_person1_id_person2_id_key UNIQUE (person1_id, person2_id);


--
-- Name: marriages marriages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marriages
    ADD CONSTRAINT marriages_pkey PRIMARY KEY (id);


--
-- Name: parent_child parent_child_parent_id_child_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_child
    ADD CONSTRAINT parent_child_parent_id_child_id_key UNIQUE (parent_id, child_id);


--
-- Name: parent_child parent_child_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_child
    ADD CONSTRAINT parent_child_pkey PRIMARY KEY (id);


--
-- Name: people people_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.people
    ADD CONSTRAINT people_pkey PRIMARY KEY (id);


--
-- Name: person_claims person_claims_person_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_claims
    ADD CONSTRAINT person_claims_person_id_key UNIQUE (person_id);


--
-- Name: person_claims person_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_claims
    ADD CONSTRAINT person_claims_pkey PRIMARY KEY (user_id);


--
-- Name: person_submissions person_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_submissions
    ADD CONSTRAINT person_submissions_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_pc_child; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pc_child ON public.parent_child USING btree (child_id);


--
-- Name: idx_pc_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pc_parent ON public.parent_child USING btree (parent_id);


--
-- Name: idx_people_display_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_people_display_name ON public.people USING btree (lower(display_name));


--
-- Name: idx_person_submissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_submissions_status ON public.person_submissions USING btree (status);


--
-- Name: one_pending_edit_per_person; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_pending_edit_per_person ON public.person_submissions USING btree (person_id) WHERE ((status = 'pending'::text) AND (kind = 'edit'::text));


--
-- Name: one_pending_submission_per_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_pending_submission_per_user ON public.person_submissions USING btree (user_id) WHERE (status = 'pending'::text);


--
-- Name: people people_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: person_submissions person_submissions_before_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER person_submissions_before_insert BEFORE INSERT ON public.person_submissions FOR EACH ROW EXECUTE FUNCTION public.person_submissions_before_insert();


--
-- Name: marriages marriages_person1_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marriages
    ADD CONSTRAINT marriages_person1_id_fkey FOREIGN KEY (person1_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: marriages marriages_person2_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marriages
    ADD CONSTRAINT marriages_person2_id_fkey FOREIGN KEY (person2_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: parent_child parent_child_child_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_child
    ADD CONSTRAINT parent_child_child_id_fkey FOREIGN KEY (child_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: parent_child parent_child_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_child
    ADD CONSTRAINT parent_child_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: person_claims person_claims_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_claims
    ADD CONSTRAINT person_claims_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE CASCADE;


--
-- Name: person_claims person_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_claims
    ADD CONSTRAINT person_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: person_submissions person_submissions_added_parent_of_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_submissions
    ADD CONSTRAINT person_submissions_added_parent_of_fkey FOREIGN KEY (added_parent_of) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: person_submissions person_submissions_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_submissions
    ADD CONSTRAINT person_submissions_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: person_submissions person_submissions_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_submissions
    ADD CONSTRAINT person_submissions_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.people(id) ON DELETE SET NULL;


--
-- Name: person_submissions person_submissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person_submissions
    ADD CONSTRAINT person_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: person_claims Anyone can read claimed contact; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read claimed contact" ON public.person_claims FOR SELECT USING (true);


--
-- Name: marriages Anyone can view marriages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view marriages" ON public.marriages FOR SELECT USING (true);


--
-- Name: people Anyone can view people; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view people" ON public.people FOR SELECT USING (true);


--
-- Name: parent_child Anyone can view relationships; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view relationships" ON public.parent_child FOR SELECT USING (true);


--
-- Name: marriages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.marriages ENABLE ROW LEVEL SECURITY;

--
-- Name: parent_child; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.parent_child ENABLE ROW LEVEL SECURITY;

--
-- Name: people; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

--
-- Name: person_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: person_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--


