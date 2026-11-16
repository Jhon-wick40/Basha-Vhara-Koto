-- =============================================================================
-- Migration: Chatbot FAQs & AI Assistant Knowledge Base
-- 1. Creates public.chatbot_faqs table for Admin-managed auto-reply Q&A.
-- 2. Sets RLS: Anyone can view active FAQs, only Admins can create/edit/delete.
-- 3. Seeds initial platform Q&A for instant auto-reply.
-- =============================================================================

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

-- Enable RLS
ALTER TABLE public.chatbot_faqs ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Active FAQs are viewable by everyone" ON public.chatbot_faqs;
DROP POLICY IF EXISTS "Admins can manage FAQs" ON public.chatbot_faqs;

-- Anyone (authenticated or anon) can view active FAQs
CREATE POLICY "Active FAQs are viewable by everyone"
  ON public.chatbot_faqs FOR SELECT
  TO authenticated, anon
  USING (is_active = true OR public.is_admin());

-- Only admins can insert, update, delete FAQs
CREATE POLICY "Admins can manage FAQs"
  ON public.chatbot_faqs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Auto bump updated_at
DROP TRIGGER IF EXISTS trg_chatbot_faqs_updated_at ON public.chatbot_faqs;
CREATE TRIGGER trg_chatbot_faqs_updated_at
  BEFORE UPDATE ON public.chatbot_faqs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed initial essential FAQs if table is empty
INSERT INTO public.chatbot_faqs (question, answer, category, keywords, sort_order)
SELECT 
  'What is a Custom User ID (e.g. T-238723)?',
  'Every user on Basha Vhara Koto has a unique, memorable Custom ID (such as T-238723 for tenants or L-XXXXXX for landlords). You can copy it from your Profile page and share it with landlords for background lookup, rental history, and reviews. Both your Custom ID and your Supabase UUID work everywhere.',
  'uid',
  ARRAY['uid', 'custom id', 't-', 'custom uid', 'id', 'shareable id'],
  1
WHERE NOT EXISTS (SELECT 1 FROM public.chatbot_faqs WHERE category = 'uid');

INSERT INTO public.chatbot_faqs (question, answer, category, keywords, sort_order)
SELECT 
  'How do I look up a tenant''s rental history?',
  'Landlords can go to the "Look up a tenant" page (/tenant-lookup), enter the tenant''s Custom ID (e.g. T-238723) or UUID, and click "View history". You will see their verified KYC status, past agreements, and timely rent records.',
  'tenant',
  ARRAY['lookup', 'tenant history', 'rental history', 'search tenant', 'background check'],
  2
WHERE NOT EXISTS (SELECT 1 FROM public.chatbot_faqs WHERE question ILIKE '%look up a tenant%');

INSERT INTO public.chatbot_faqs (question, answer, category, keywords, sort_order)
SELECT 
  'How does KYC verification work?',
  'Go to the KYC page (/kyc), upload a clear photo of your National ID (NID) or Passport (front and back) and a selfie. Our admin team will verify your documents to award you the verified safety badge on your profile.',
  'kyc',
  ARRAY['kyc', 'nid', 'verify', 'passport', 'verification', 'badge'],
  3
WHERE NOT EXISTS (SELECT 1 FROM public.chatbot_faqs WHERE category = 'kyc');

INSERT INTO public.chatbot_faqs (question, answer, category, keywords, sort_order)
SELECT 
  'How do landlords post a new rental listing?',
  'If you have a landlord role, click "List a House" in the navigation bar or visit /landlord/listings/new. Provide property details, rent amount (BDT), address, division, district, thana, upload property photos, and click Publish.',
  'landlord',
  ARRAY['list', 'listing', 'post house', 'post flat', 'rent out', 'landlord'],
  4
WHERE NOT EXISTS (SELECT 1 FROM public.chatbot_faqs WHERE category = 'landlord');

INSERT INTO public.chatbot_faqs (question, answer, category, keywords, sort_order)
SELECT 
  'How does rent payment and receipt work?',
  'Once an agreement is active, tenants can pay monthly rent securely on the platform. After payment, a permanent digital receipt is generated with payment status, date, and agreement ID, adding positively to your rental score.',
  'general',
  ARRAY['payment', 'pay rent', 'receipt', 'bdt', 'money', 'agreement'],
  5
WHERE NOT EXISTS (SELECT 1 FROM public.chatbot_faqs WHERE question ILIKE '%rent payment%');
