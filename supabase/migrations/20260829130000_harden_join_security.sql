-- Keep contact details private, close admin bootstrap, and protect tree integrity.

REVOKE SELECT ON public.person_claims FROM anon;
DROP POLICY IF EXISTS "Anyone can read claimed contact" ON public.person_claims;
DROP POLICY IF EXISTS "Users read own claims, admins read all" ON public.person_claims;
CREATE POLICY "Users read own claims, admins read all"
  ON public.person_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- The Join picker only needs to know that a person is claimed. For the current
-- user's claim, return their ID so client validation can distinguish "mine".
CREATE OR REPLACE FUNCTION public.person_claim_index()
RETURNS TABLE(person_id UUID, user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    claim.person_id,
    CASE
      WHEN claim.user_id = auth.uid() THEN claim.user_id
      ELSE '00000000-0000-0000-0000-000000000000'::UUID
    END
  FROM public.person_claims AS claim
  WHERE auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.person_claim_index() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_claim_index() TO authenticated;

-- Admin access must be provisioned deliberately with the service role or SQL.
REVOKE ALL ON FUNCTION public.claim_admin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_parent_child_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_excluded_id UUID;
BEGIN
  -- ponytail: serialize relationship writes; replace with ordered per-person
  -- advisory locks only if this small family tree ever has heavy write traffic.
  PERFORM pg_advisory_xact_lock(hashtext('parent_child_integrity'));

  IF TG_OP = 'UPDATE' THEN
    v_excluded_id := OLD.id;
  END IF;

  IF (
    SELECT count(*)
    FROM public.parent_child AS link
    WHERE link.child_id = NEW.child_id
      AND (v_excluded_id IS NULL OR link.id <> v_excluded_id)
  ) >= 2 THEN
    RAISE EXCEPTION 'A person cannot have more than two parents';
  END IF;

  IF EXISTS (
    WITH RECURSIVE descendants(id) AS (
      SELECT NEW.child_id
      UNION
      SELECT link.child_id
      FROM public.parent_child AS link
      JOIN descendants ON descendants.id = link.parent_id
      WHERE v_excluded_id IS NULL OR link.id <> v_excluded_id
    )
    SELECT 1 FROM descendants WHERE id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION 'This relationship would create a family-tree cycle';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_parent_child_integrity ON public.parent_child;
CREATE TRIGGER validate_parent_child_integrity
  BEFORE INSERT OR UPDATE OF parent_id, child_id ON public.parent_child
  FOR EACH ROW EXECUTE FUNCTION public.validate_parent_child_integrity();
