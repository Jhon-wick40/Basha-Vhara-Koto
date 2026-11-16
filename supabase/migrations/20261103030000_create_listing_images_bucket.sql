-- Create listing-images storage bucket with public read access
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
