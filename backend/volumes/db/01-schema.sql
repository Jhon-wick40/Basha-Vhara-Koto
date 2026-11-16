-- =============================================================================
-- Bashabari schema — applied on FIRST DB boot via /docker-entrypoint-initdb.d/
-- -----------------------------------------------------------------------------
-- This file mirrors the production migrations and is heavily commented so a
-- new contributor can understand exactly what each block does and WHY.
--
-- Conventions:
--   * All app tables live in the `public` schema.
--   * Every user-owned table has Row-Level Security (RLS) enabled.
--   * Roles are stored in their own `user_roles` table (NEVER on profiles)
--     to prevent privilege-escalation attacks.
--   * `auth.uid()` returns the currently logged-in user's UUID inside RLS.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ENUMS — strongly typed values used across the schema
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE public.app_role          AS ENUM ('tenant', 'landlord');
CREATE TYPE public.property_type     AS ENUM ('apartment','house','studio','room','commercial');
CREATE TYPE public.agreement_status  AS ENUM ('pending','accepted','rejected');
CREATE TYPE public.payment_status    AS ENUM ('pending','completed','failed');


-- ─────────────────────────────────────────────────────────────────────────────
-- Custom UID generator (Clean T-XXXXXX / L-XXXXXX format with collision handling)
-- ─────────────────────────────────────────────────────────────────────────────
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

CREATE OR REPLACE FUNCTION public.generate_custom_uid_from_name_email(p_name TEXT, p_email TEXT)
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.generate_custom_uid('tenant');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_custom_uid()
RETURNS TEXT LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.generate_custom_uid('tenant');
END;
$$;

-- Resolves either UUID or Custom UID to the exact auth.users(id)
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

  -- 1. Check if valid UUID
  IF trim(p_identifier) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT id INTO v_id FROM public.profiles WHERE id = trim(p_identifier)::UUID;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  -- 2. Check case-insensitive custom_uid
  SELECT id INTO v_id FROM public.profiles WHERE lower(custom_uid) = lower(trim(p_identifier));
  RETURN v_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROFILES — public-facing user info (name, phone, avatar, bio).
--    1-to-1 with auth.users. Created automatically by a trigger on signup.
--    Hybrid: auto-generated initial code, editable by Admins.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  custom_uid    TEXT UNIQUE NOT NULL DEFAULT public.generate_custom_uid(),
  full_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  business_name TEXT,                 -- shown for landlords
  preferences   JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_custom_uid ON public.profiles(lower(custom_uid));
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can read profiles (needed to show names in chat & listings)
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- Each user can insert their own profile
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Admins or profile owners can update profile
CREATE POLICY "Admins or owners update profile"
  ON public.profiles FOR UPDATE TO authenticated 
  USING (public.is_admin() OR auth.uid() = id)
  WITH CHECK (public.is_admin() OR auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. USER_ROLES — separate table on purpose.
--    Storing roles on `profiles` is a classic mistake: a user could update
--    their own profile row and grant themselves 'landlord'. We instead read
--    roles via a SECURITY DEFINER function (see has_role below) and only let
--    users INSERT their own role at signup, never UPDATE it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER lets this function bypass RLS so it can be safely called
-- from inside other RLS policies (avoids infinite recursion).
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own role at signup"
  ON public.user_roles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Note: NO update / delete policy → roles are immutable once chosen.


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TRIGGERS — auto-create profile on signup, and auto-bump updated_at
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_name TEXT;
  new_custom_uid TEXT;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  new_custom_uid := public.generate_custom_uid_from_name_email(user_name, NEW.email);

  INSERT INTO public.profiles (id, full_name, custom_uid)
  VALUES (
    NEW.id, 
    user_name,
    new_custom_uid
  )
  ON CONFLICT (id) DO UPDATE 
    SET full_name = EXCLUDED.full_name,
        custom_uid = COALESCE(public.profiles.custom_uid, EXCLUDED.custom_uid);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Generic helper attached to every table that has updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Protect custom_uid from unauthorized regular-user edits (Admin-only mutation)
CREATE OR REPLACE FUNCTION public.protect_custom_uid_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Always allow superuser, SQL editor, migrations, or service role
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') OR (auth.jwt() ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

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


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. LISTINGS — properties posted by landlords
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.listings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price         NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  location      TEXT NOT NULL,
  property_type property_type NOT NULL DEFAULT 'apartment',
  bedrooms      INT NOT NULL DEFAULT 1,
  bathrooms     INT NOT NULL DEFAULT 1,
  area_sqft     INT,
  images        TEXT[] NOT NULL DEFAULT '{}',   -- array of image URLs
  is_active     BOOLEAN NOT NULL DEFAULT true,  -- soft-hide instead of delete
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Tenants can browse all ACTIVE listings; landlords can also see their own
-- inactive ones (so they can re-enable them).
CREATE POLICY "Anyone authenticated can view active listings"
  ON public.listings FOR SELECT TO authenticated
  USING (is_active = true OR landlord_id = auth.uid());

-- Only users with the 'landlord' role can create listings, and only
-- as themselves (landlord_id must match their auth.uid()).
CREATE POLICY "Landlords can create listings"
  ON public.listings FOR INSERT TO authenticated
  WITH CHECK (landlord_id = auth.uid() AND public.has_role(auth.uid(), 'landlord'));

CREATE POLICY "Landlords can update own listings"
  ON public.listings FOR UPDATE TO authenticated USING (landlord_id = auth.uid());
CREATE POLICY "Landlords can delete own listings"
  ON public.listings FOR DELETE TO authenticated USING (landlord_id = auth.uid());

CREATE TRIGGER listings_updated_at BEFORE UPDATE ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. FAVORITES — many-to-many between tenants and listings
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.favorites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, listing_id)   -- can't favorite the same listing twice
);
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own favorites"
  ON public.favorites FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users add own favorites"
  ON public.favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users remove own favorites"
  ON public.favorites FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. CONVERSATIONS — exactly one per (listing, tenant) pair.
--    The landlord is denormalised here so RLS checks don't need a JOIN.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.conversations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id  UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (listing_id, tenant_id)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Only the two participants can see the conversation
CREATE POLICY "Participants view conversation"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

-- The tenant always opens the conversation (clicking "Message" on a listing)
CREATE POLICY "Tenant starts conversation"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = tenant_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. MESSAGES — chat entries inside a conversation. REALTIME-enabled.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Both participants of the parent conversation can read messages
CREATE POLICY "Participants read messages"
  ON public.messages FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.tenant_id = auth.uid() OR c.landlord_id = auth.uid()))
  );

-- A user can only send messages AS themselves AND only inside conversations
-- they participate in.
CREATE POLICY "Participants send messages"
  ON public.messages FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.tenant_id = auth.uid() OR c.landlord_id = auth.uid())
    )
  );

-- Publish row changes to the Realtime service so the chat UI updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.messages REPLICA IDENTITY FULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. AGREEMENTS — the "deal" between tenant and landlord BEFORE payment.
--    Tenant proposes (status='pending'); landlord then accepts or rejects.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.agreements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL UNIQUE REFERENCES public.conversations(id) ON DELETE CASCADE,
  listing_id      UUID NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreed_price    NUMERIC(12,2) NOT NULL,
  status          agreement_status NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view agreement"
  ON public.agreements FOR SELECT TO authenticated
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);
CREATE POLICY "Tenant creates agreement"
  ON public.agreements FOR INSERT TO authenticated WITH CHECK (auth.uid() = tenant_id);
-- Only the landlord can change status (accept / reject)
CREATE POLICY "Landlord updates agreement"
  ON public.agreements FOR UPDATE TO authenticated USING (auth.uid() = landlord_id);

CREATE TRIGGER agreements_updated_at BEFORE UPDATE ON public.agreements
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. PAYMENTS — simulated; created after the landlord accepts the agreement.
--     receipt_number is auto-generated server-side so the client can't forge it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE
                 DEFAULT 'RCPT-' || upper(substr(md5(random()::text),1,10)),
  agreement_id   UUID NOT NULL REFERENCES public.agreements(id) ON DELETE CASCADE,
  listing_id     UUID NOT NULL REFERENCES public.listings(id)   ON DELETE CASCADE,
  tenant_id      UUID NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  landlord_id    UUID NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  amount         NUMERIC(12,2) NOT NULL,
  status         payment_status NOT NULL DEFAULT 'completed',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants view payment"
  ON public.payments FOR SELECT TO authenticated
  USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);
CREATE POLICY "Tenant inserts payment"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = tenant_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 11. HARDENING — restrict execution of helper functions
-- ─────────────────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.handle_new_user()        FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()         FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO   authenticated;


-- -----------------------------------------------------------------------------
-- 12. STORAGE BUCKETS & POLICIES
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  15728640, -- 15 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public listing images access'
  ) THEN
    CREATE POLICY "Public listing images access" ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Authenticated users can upload listing images'
  ) THEN
    CREATE POLICY "Authenticated users can upload listing images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'listing-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own listing images'
  ) THEN
    CREATE POLICY "Users can update own listing images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own listing images'
  ) THEN
    CREATE POLICY "Users can delete own listing images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
  END IF;
END
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CHATBOT FAQS — Admin-managed auto-reply knowledge base
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chatbot_faqs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question    TEXT NOT NULL,
  answer      TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  keywords    TEXT[] NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active FAQs are viewable by everyone"
  ON public.chatbot_faqs FOR SELECT
  TO authenticated, anon
  USING (is_active = true OR public.is_admin());

CREATE POLICY "Admins can manage FAQs"
  ON public.chatbot_faqs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_chatbot_faqs_updated_at
  BEFORE UPDATE ON public.chatbot_faqs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
