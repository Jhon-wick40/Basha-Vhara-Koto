-- =============================================================================
-- Migration: Hybrid Custom UID System (Clean T-XXXXXX / L-XXXXXX Format)
-- 1. Automatically generates a clean, short code (e.g. T-238723) on signup.
-- 2. Admins can override/edit/create any custom UID (e.g. 'T-238723', 'bkij1010').
-- 3. SQL Editor, Service Role, & Admins have full access to mutate custom_uid.
-- 4. Regular users can view & share their custom UID, but cannot tamper with it.
-- 5. Preserves auth.users(id) UUID as primary key so both UIDs work everywhere.
-- =============================================================================

-- 1. Helper function to check admin / privileged status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    current_user IN ('postgres', 'service_role', 'supabase_admin')
    OR (auth.jwt() ->> 'role') = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role::text = 'admin'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role, anon;

-- 2. Generator function: Generates clean short IDs like T-238723 or L-481902
CREATE OR REPLACE FUNCTION public.generate_custom_uid(p_role TEXT DEFAULT 'tenant')
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  prefix TEXT := 'T-';
  rand_code TEXT;
  final_uid TEXT;
  done BOOLEAN := FALSE;
BEGIN
  IF lower(COALESCE(p_role, '')) = 'landlord' THEN
    prefix := 'L-';
  ELSE
    prefix := 'T-';
  END IF;

  WHILE NOT done LOOP
    rand_code := lpad(floor(random() * 900000 + 100000)::TEXT, 6, '0');
    final_uid := prefix || rand_code;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE lower(custom_uid) = lower(final_uid)) THEN
      done := TRUE;
    END IF;
  END LOOP;

  RETURN final_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_custom_uid(TEXT) TO authenticated, service_role, anon;

-- Alias for backward compatibility with AuthContext / Admin calls
CREATE OR REPLACE FUNCTION public.generate_custom_uid_from_name_email(p_name TEXT, p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.generate_custom_uid('tenant');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_custom_uid_from_name_email(TEXT, TEXT) TO authenticated, service_role, anon;

-- Fallback with 0 arguments
CREATE OR REPLACE FUNCTION public.generate_custom_uid()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.generate_custom_uid('tenant');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_custom_uid() TO authenticated, service_role, anon;

-- 3. Universal Resolver Function: Resolves either UUID or Custom UID to the exact auth.users(id)
CREATE OR REPLACE FUNCTION public.resolve_user_id(p_identifier TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_identifier IS NULL OR trim(p_identifier) = '' THEN
    RETURN NULL;
  END IF;

  -- A. Check if valid UUID
  IF trim(p_identifier) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_id FROM public.profiles WHERE id = trim(p_identifier)::UUID;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  -- B. Check case-insensitive custom_uid
  SELECT id INTO v_id FROM public.profiles WHERE lower(custom_uid) = lower(trim(p_identifier));
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_user_id(TEXT) TO authenticated, service_role, anon;

-- 4. Add custom_uid column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'profiles' 
      AND column_name = 'custom_uid'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN custom_uid TEXT;
  END IF;
END $$;

-- 5. Backfill any existing profiles missing a custom_uid with clean T-XXXXXX codes
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.profiles WHERE custom_uid IS NULL LOOP
    UPDATE public.profiles 
    SET custom_uid = public.generate_custom_uid('tenant')
    WHERE id = rec.id;
  END LOOP;
END $$;

-- 6. Enforce DEFAULT and NOT NULL
ALTER TABLE public.profiles 
  ALTER COLUMN custom_uid SET DEFAULT public.generate_custom_uid(),
  ALTER COLUMN custom_uid SET NOT NULL;

-- 7. Case-insensitive unique index
DROP INDEX IF EXISTS public.idx_profiles_custom_uid;
CREATE UNIQUE INDEX idx_profiles_custom_uid 
  ON public.profiles(lower(custom_uid));

-- 8. RLS Policies on public.profiles
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins or owners update profile" ON public.profiles;

CREATE POLICY "Admins or owners update profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR auth.uid() = id)
  WITH CHECK (public.is_admin() OR auth.uid() = id);

-- 9. Trigger to protect custom_uid from unauthorized regular-user edits
CREATE OR REPLACE FUNCTION public.protect_custom_uid_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Always allow superuser, SQL editor, migrations, or service role
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') OR (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- If custom_uid already exists and is changing, only an admin may mutate it
  IF (OLD.custom_uid IS NOT NULL AND NEW.custom_uid IS DISTINCT FROM OLD.custom_uid) THEN
    IF NOT public.is_admin() THEN
      NEW.custom_uid := OLD.custom_uid;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_custom_uid ON public.profiles;
CREATE TRIGGER trg_protect_custom_uid
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_custom_uid_update();

-- 10. Update handle_new_user() trigger to automatically assign initial custom_uid
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_name TEXT;
  new_custom_uid TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  new_custom_uid := public.generate_custom_uid('tenant');

  INSERT INTO public.profiles (id, full_name, custom_uid)
  VALUES (
    NEW.id, 
    COALESCE(user_name, ''),
    new_custom_uid
  )
  ON CONFLICT (id) DO UPDATE 
    SET full_name = EXCLUDED.full_name,
        custom_uid = COALESCE(public.profiles.custom_uid, EXCLUDED.custom_uid);

  RETURN NEW;
END;
$$;
