-- Signup must stay on babafeqi.raafat.site. Lovable Cloud still sends a
-- confirmation email whose default link opens the Lovable preview. Confirm
-- accounts here so family never has to click that mail. Admin review of
-- person_submissions is unchanged.

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email_confirmed_at IS NULL;

CREATE OR REPLACE FUNCTION public.confirm_auth_user_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.email_confirmed_at := COALESCE(NEW.email_confirmed_at, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS confirm_auth_user_on_insert ON auth.users;
CREATE TRIGGER confirm_auth_user_on_insert
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.confirm_auth_user_on_insert();
