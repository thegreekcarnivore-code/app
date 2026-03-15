CREATE POLICY "Users can delete own video progress"
ON public.client_video_progress
FOR DELETE
USING (auth.uid() = user_id);