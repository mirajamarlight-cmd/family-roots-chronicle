CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.people (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT,
  display_name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  death_date DATE,
  photo_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.people TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.parent_child (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'biological',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_id, child_id),
  CHECK (parent_id <> child_id)
);
GRANT SELECT ON public.parent_child TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_child TO authenticated;
GRANT ALL ON public.parent_child TO service_role;
ALTER TABLE public.parent_child ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.marriages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person1_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  person2_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  marriage_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (person1_id, person2_id),
  CHECK (person1_id <> person2_id)
);
GRANT SELECT ON public.marriages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marriages TO authenticated;
GRANT ALL ON public.marriages TO service_role;
ALTER TABLE public.marriages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Anyone can view people" ON public.people FOR SELECT USING (true);
CREATE POLICY "Admins manage people" ON public.people FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Anyone can view relationships" ON public.parent_child FOR SELECT USING (true);
CREATE POLICY "Admins manage relationships" ON public.parent_child FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Anyone can view marriages" ON public.marriages FOR SELECT USING (true);
CREATE POLICY "Admins manage marriages" ON public.marriages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_people_display_name ON public.people (lower(display_name));
CREATE INDEX idx_pc_parent ON public.parent_child (parent_id);
CREATE INDEX idx_pc_child ON public.parent_child (child_id);

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER people_updated_at BEFORE UPDATE ON public.people FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.claim_admin() RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN RETURN FALSE; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin') ON CONFLICT DO NOTHING;
  RETURN TRUE;
END; $$;
GRANT EXECUTE ON FUNCTION public.claim_admin() TO authenticated;

CREATE TABLE public._seed_paths (path TEXT PRIMARY KEY, id UUID NOT NULL DEFAULT gen_random_uuid());

INSERT INTO public._seed_paths (path) VALUES
('Yonis'),
('Yonis>Ahmed'),
('Yonis>Ahmed>Abdosh'),
('Yonis>Ahmed>Abdosh>Rewda'),
('Yonis>Ahmed>Abdosh>Kemya'),
('Yonis>Ahmed>Abdosh>Kemya>Saedi'),
('Yonis>Ahmed>Abdosh>Kemya>Orit'),
('Yonis>Ahmed>Abdosh>Maria'),
('Yonis>Ahmed>Abdosh>Maria>Abdulwahid'),
('Yonis>Ahmed>Abdosh>Yonis'),
('Yonis>Ahmed>Abdosh>Yonis>Muna'),
('Yonis>Ahmed>Abdosh>Yonis>Hamdi'),
('Yonis>Ahmed>Abdosh>Yonis>Eliyas'),
('Yonis>Ahmed>Abdosh>Yonis>Eliyas>Ezdihar'),
('Yonis>Ahmed>Abdosh>Yonis>Eliyas>Khulud'),
('Yonis>Ahmed>Abdosh>Yonis>Eliyas>Mim'),
('Yonis>Ahmed>Abdosh>Yonis>Eliyas>Yaa'),
('Yonis>Ahmed>Abdosh>Yonis>Diniya'),
('Yonis>Ahmed>Abdosh>Yonis>Diniya>Atiqa'),
('Yonis>Ahmed>Abdosh>Yonis>Diniya>Abdullahi'),
('Yonis>Ahmed>Abdosh>Yonis>Diniya>Aliya'),
('Yonis>Ahmed>Abdosh>Yonis>Diniya>Aisha'),
('Yonis>Ahmed>Abdosh>Yonis>Ahmed'),
('Yonis>Ahmed>Abdosh>Yonis>Dedsam'),
('Yonis>Ahmed>Abdosh>Yonis>Reyan'),
('Yonis>Ahmed>Abdosh>Yonis>Siyam'),
('Yonis>Ahmed>Abdosh>Ilias'),
('Yonis>Ahmed>Abdosh>Ilias>Abdulmenan'),
('Yonis>Ahmed>Abdosh>Ilias>Abdulmenan>Ayan'),
('Yonis>Ahmed>Abdosh>Ilias>Abdulmenan>Muhammed'),
('Yonis>Ahmed>Abdosh>Ilias>Hanan'),
('Yonis>Ahmed>Abdosh>Ilias>Khulud'),
('Yonis>Ahmed>Abdosh>Ilias>Sumeya'),
('Yonis>Ahmed>Abdosh>Ilias>Abdulkerim'),
('Yonis>Ahmed>Abdosh>Zekeriya'),
('Yonis>Ahmed>Abdosh>Ishaq'),
('Yonis>Ahmed>Abdosh>Ishaq>Reyan'),
('Yonis>Ahmed>Abdosh>Ishaq>Hassenet'),
('Yonis>Ahmed>Abdosh>Ishaq>Ekram'),
('Yonis>Ahmed>Abdosh>Eled'),
('Yonis>Ahmed>Abdosh>Eled>Kimiyet'),
('Yonis>Ahmed>Abdosh>Eled>Welid'),
('Yonis>Ahmed>Abdosh>Erit'),
('Yonis>Ahmed>Abdosh>Erit>Zekeriya'),
('Yonis>Ahmed>Abdosh>Assas'),
('Yonis>Ahmed>Abdosh>Assas>Amir'),
('Yonis>Ahmed>Abdosh>Assas>Testi'),
('Yonis>Ahmed>Abdosh>Assas>Mahir'),
('Yonis>Ahmed>Abdosh>Assas>Nihan'),
('Yonis>Ahmed>Abdosh>Teweleda'),
('Yonis>Ahmed>Abdosh>Teweleda>Abdulhamid'),
('Yonis>Ahmed>Abdosh>Teweleda>Abdurehim'),
('Yonis>Ahmed>Abdosh>Teweleda>Fatuma'),
('Yonis>Ahmed>Abdosh>Teweleda>Amar'),
('Yonis>Ahmed>Abdosh>Tekaba'),
('Yonis>Ahmed>Abdosh>Tekaba>Yenber'),
('Yonis>Ahmed>Abdosh>Tekaba>Reyan'),
('Yonis>Ahmed>Abdosh>Tekaba>Eman'),
('Yonis>Ahmed>Abdosh>Tekaba>Aya'),
('Yonis>Ahmed>Abdosh>Nibarot'),
('Yonis>Ahmed>Abdosh>Nibarot>Abdurahman'),
('Yonis>Ahmed>Abdosh>Birna'),
('Yonis>Ahmed>Abdosh>Birna>Ahmed'),
('Yonis>Ahmed>Abdosh>Birna>Elham'),
('Yonis>Ahmed>Abdosh>Birna>Santi'),
('Yonis>Ahmed>Abdosh>Sinet'),
('Yonis>Ahmed>Abdosh>Sinet>Sumeya'),
('Yonis>Ahmed>Abdosh>Sinet>Samti'),
('Yonis>Ahmed>Fatuma'),
('Yonis>Ahmed>Fatuma>Rania'),
('Yonis>Ahmed>Fatuma>Hayat'),
('Yonis>Ahmed>Fatuma>Abdulrahman'),
('Yonis>Ahmed>Fatuma>Kidlang'),
('Yonis>Ahmed>Fatuma>Ahmed'),
('Yonis>Ahmed>Fatuma>Firdaws'),
('Yonis>Ahmed>Fatuma>Khalid'),
('Yonis>Ahmed>Fatuma>Sitra'),
('Yonis>Ahmed>Khedra'),
('Yonis>Ahmed>Khedra>Tofik'),
('Yonis>Ahmed>Khedra>Tofik>Sami'),
('Yonis>Ahmed>Khedra>Tofik>Nejwa'),
('Yonis>Ahmed>Khedra>Tofik>Remzi'),
('Yonis>Ahmed>Khedra>Tofik>Mohamed'),
('Yonis>Ahmed>Khedra>Ahmed'),
('Yonis>Ahmed>Khedra>Ahmed>Abdulmenan'),
('Yonis>Ahmed>Khedra>Ahmed>Zein'),
('Yonis>Ahmed>Khedra>Yusuf'),
('Yonis>Ahmed>Khedra>Yusuf>Semir'),
('Yonis>Ahmed>Khedra>Yusuf>Semiha'),
('Yonis>Ahmed>Khedra>Yusuf>Sitra'),
('Yonis>Ahmed>Khedra>Hayat'),
('Yonis>Ahmed>Khedra>Hayat>Fethi'),
('Yonis>Ahmed>Khedra>Hayat>Elham'),
('Yonis>Ahmed>Khedra>Hayat>Muaz'),
('Yonis>Ahmed>Khedra>Amira'),
('Yonis>Ahmed>Khedra>Amira>Sumeya'),
('Yonis>Ahmed>Khedra>Amira>Fatma'),
('Yonis>Ahmed>Khedra>Amira>Meryem'),
('Yonis>Ahmed>Khedra>Mufti'),
('Yonis>Ahmed>Khedra>Mufti>Amar'),
('Yonis>Ahmed>Khedra>Mufti>Hafsa'),
('Yonis>Ahmed>Khedra>Mufti>Jafer'),
('Yonis>Ahmed>Khedra>Mufti>Abdurrahman'),
('Yonis>Ahmed>Khedra>Sada'),
('Yonis>Ahmed>Khedra>Atika'),
('Yonis>Ahmed>Khedra>Hassen'),
('Yonis>Ahmed>Khedra>Hassen>Zakir'),
('Yonis>Ahmed>Khedra>Hassen>Amir'),
('Yonis>Ahmed>Khedra>Hassen>Yusra'),
('Yonis>Ahmed>Khedra>Ayneb'),
('Yonis>Ahmed>Khedra>Ayneb>Yusuf'),
('Yonis>Ahmed>Khedra>Ayneb>Anwar'),
('Yonis>Ahmed>Khedra>Ayneb>Humeyda'),
('Yonis>Ahmed>Khedra>Ayneb>Mereyem'),
('Yonis>Ahmed>Khedra>Ayneb>Khalid'),
('Yonis>Ahmed>Khedra>Ismail'),
('Yonis>Ahmed>Sefiya'),
('Yonis>Ahmed>Sefiya>Al-Amin'),
('Yonis>Ahmed>Sefiya>Alawiya'),
('Yonis>Ahmed>Sefiya>Maymuna'),
('Yonis>Ahmed>Sefiya>Fadbon'),
('Yonis>Ahmed>Sefiya>Abdulkarim'),
('Yonis>Ahmed>Sefiya>Abdulwahab'),
('Yonis>Ahmed>Sefiya>Mohammed'),
('Yonis>Ahmed>Meymuna'),
('Yonis>Ahmed>Meymuna>Zakir'),
('Yonis>Ahmed>Meymuna>Mardi'),
('Yonis>Ahmed>Meymuna>Samti'),
('Yonis>Ahmed>Abdusemed'),
('Yonis>Ahmed>Abdusemed>Najah'),
('Yonis>Ahmed>Abdusemed>Azeb'),
('Yonis>Ahmed>Abdusemed>Adib'),
('Yonis>Ahmed>Abdusemed>Amir'),
('Yonis>Ahmed>Abdusemed>Tasti'),
('Yonis>Ahmed>Abdusemed>Hamdi'),
('Yonis>Ahmed>Abdulmanan'),
('Yonis>Ahmed>Abdulmanan>Jalud'),
('Yonis>Ahmed>Abdulmanan>Fethi'),
('Yonis>Ahmed>Amina'),
('Yonis>Ahmed>Amina>Afendi'),
('Yonis>Ahmed>Amina>Zeki'),
('Yonis>Ahmed>Ametulla'),
('Yonis>Ahmed>Ametulla>Nader'),
('Yonis>Ahmed>Ametulla>Babker'),
('Yonis>Ahmed>Ametulla>Asaad'),
('Yonis>Ahmed>Ametulla>Suhair'),
('Yonis>Ahmed>Ametulla>Siham'),
('Yonis>Ahmed>Ametulla>Ajmal'),
('Yonis>Ahmed>Ametulla>Ayman'),
('Yonis>Ahmed>Kimya'),
('Yonis>Ahmed>Kimya>Muktar'),
('Yonis>Ahmed>Nejuma'),
('Yonis>Ahmed>Nejuma>Yafet'),
('Yonis>Ahmed>Nejuma>Roco'),
('Yonis>Ahmed>Abduletif'),
('Yonis>Ahmed>Abduletif>Timaj'),
('Yonis>Ahmed>Abduletif>Welid'),
('Yonis>Ahmed>Abduletif>Titugn'),
('Yonis>Ahmed>Abdulhanan'),
('Yonis>Ahmed>Hafiza'),
('Yonis>Ahmed>Hafiza>Niya'),
('Yonis>Ahmed>Hafiza>Mohammed'),
('Yonis>Ahmed>Abdurehim'),
('Yonis>Ahmed>Alfuleyla'),
('Yonis>Ahmed>Alfuleyla>Gizman'),
('Yonis>Ahmed>Alfuleyla>Testi'),
('Yonis>Ahmed>Alfuleyla>Eman'),
('Yonis>Ahmed>Tenber'),
('Yonis>Ahmed>Tenber>Liyana'),
('Yonis>Ahmed>Tenber>Merwan');

INSERT INTO public.people (id, first_name, display_name)
SELECT id, substring(path from '[^>]+$'), substring(path from '[^>]+$') FROM public._seed_paths;

INSERT INTO public.parent_child (parent_id, child_id)
SELECT p.id, c.id
FROM public._seed_paths c
JOIN public._seed_paths p ON p.path = regexp_replace(c.path, '>[^>]+$', '')
WHERE c.path LIKE '%>%';

DROP TABLE public._seed_paths;