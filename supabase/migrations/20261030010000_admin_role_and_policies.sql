-- =============================================================================
-- Migration: Add 'admin' role, admin policies, and verification permissions
-- =============================================================================

-- 1. Add 'admin' value to public.app_role ENUM safely
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Helper function to check if current caller is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role::text = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 3. RLS: Admin policies for KYC
DROP POLICY IF EXISTS "Admins can view all KYC" ON public.kyc;
CREATE POLICY "Admins can view all KYC" ON public.kyc
  FOR SELECT TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update KYC" ON public.kyc;
CREATE POLICY "Admins can update KYC" ON public.kyc
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

-- 4. RLS: Admin policies for Listings
DROP POLICY IF EXISTS "Admins can manage all listings" ON public.listings;
CREATE POLICY "Admins can manage all listings" ON public.listings
  FOR ALL TO authenticated
  USING (public.is_admin() OR auth.uid() = landlord_id);

-- 5. RLS: Admin policies for User Roles
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_admin() OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_admin());

-- 6. Storage: Allow admins to view KYC documents in kyc-docs bucket
DROP POLICY IF EXISTS "Admins can view all kyc docs" ON storage.objects;
CREATE POLICY "Admins can view all kyc docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-docs' AND (
      public.is_admin() OR 
      auth.uid()::text = (storage.foldername(name))[1]
    )
  );
