-- =============================================================================
-- Migration: Add kyc_status to public.profiles and sync from public.kyc
-- 1. Allows landlords and public authenticated users to see a tenant's KYC badge
--    without exposing sensitive NID numbers and photo documents in public.kyc.
-- 2. Automatically keeps public.profiles.kyc_status in sync with public.kyc.status.
-- =============================================================================

-- 1. Add kyc_status column to profiles if it doesn't already exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status DEFAULT 'pending';

-- 2. Sync existing KYC statuses from kyc table to profiles
UPDATE public.profiles p
SET kyc_status = k.status
FROM public.kyc k
WHERE k.user_id = p.id;

-- 3. Create auto-sync trigger function
CREATE OR REPLACE FUNCTION public.sync_kyc_status_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET kyc_status = NEW.status, updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- 4. Attach trigger to public.kyc
DROP TRIGGER IF EXISTS tr_sync_kyc_status ON public.kyc;
CREATE TRIGGER tr_sync_kyc_status
AFTER INSERT OR UPDATE OF status ON public.kyc
FOR EACH ROW EXECUTE FUNCTION public.sync_kyc_status_to_profile();
