-- Application tables verified from backup + repo migrations.
-- No Supabase roles, RLS, or auth schema.

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  gender TEXT DEFAULT 'male',
  birth_date DATE,
  death_date DATE,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deceased BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.parent_child (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'biological',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  child_order SMALLINT,
  UNIQUE (parent_id, child_id),
  CHECK (parent_id <> child_id)
);

COMMENT ON COLUMN public.parent_child.child_order IS
  'Manual birth order among siblings when birth_date is unknown; lower comes first.';

CREATE TABLE IF NOT EXISTS public.marriages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person1_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  person2_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  marriage_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person1_id, person2_id),
  CHECK (person1_id <> person2_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.person_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
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
  added_parent_first_name TEXT,
  added_parent_middle_name TEXT,
  added_parent_last_name TEXT,
  added_parent_birth_date DATE,
  added_parent_death_date DATE,
  added_parent_of UUID REFERENCES public.people(id) ON DELETE SET NULL,
  other_parent_first_name TEXT,
  other_parent_middle_name TEXT,
  other_parent_last_name TEXT,
  other_parent_birth_date DATE,
  other_parent_death_date DATE,
  CONSTRAINT edit_has_person CHECK (kind <> 'edit' OR person_id IS NOT NULL),
  CONSTRAINT new_has_link_side CHECK (kind <> 'new' OR link_side IN ('father', 'mother')),
  CONSTRAINT new_has_family_link CHECK (
    kind <> 'new'
    OR parent_id IS NOT NULL
    OR (added_parent_first_name IS NOT NULL AND added_parent_of IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.person_claims (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL UNIQUE REFERENCES public.people(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_people_display_name ON public.people (lower(display_name));
CREATE INDEX IF NOT EXISTS idx_pc_parent ON public.parent_child (parent_id);
CREATE INDEX IF NOT EXISTS idx_pc_child ON public.parent_child (child_id);
CREATE INDEX IF NOT EXISTS idx_person_submissions_status ON public.person_submissions (status);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_submission_per_user
  ON public.person_submissions (user_id) WHERE status = 'pending';
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_edit_per_person
  ON public.person_submissions (person_id) WHERE status = 'pending' AND kind = 'edit';

DROP TRIGGER IF EXISTS people_updated_at ON public.people;
CREATE TRIGGER people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
