
-- Add voice message columns to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audio_url text,
  ADD COLUMN IF NOT EXISTS transcript text,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';

-- Make content nullable for audio-only messages
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN content SET DEFAULT '';

-- Create private chat-audio storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audio', 'chat-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can upload to their own folder
CREATE POLICY "Users can upload own audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-audio'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage RLS: authenticated users can read (signed URLs control access)
CREATE POLICY "Authenticated users can read chat audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-audio');
