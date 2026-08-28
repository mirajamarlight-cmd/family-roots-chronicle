-- Contact collected on Join is meant to show on the person's profile.
GRANT SELECT ON public.person_claims TO anon;

DROP POLICY IF EXISTS "Users read own claims, admins read all" ON public.person_claims;
CREATE POLICY "Anyone can read claimed contact"
  ON public.person_claims FOR SELECT
  USING (true);
