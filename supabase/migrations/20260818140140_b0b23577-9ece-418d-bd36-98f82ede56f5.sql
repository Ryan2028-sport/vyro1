CREATE TABLE public.video_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_name TEXT NOT NULL,
  duration_sec DOUBLE PRECISION NOT NULL DEFAULT 0,
  insight JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_analyses TO authenticated;
GRANT ALL ON public.video_analyses TO service_role;
ALTER TABLE public.video_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own video analyses" ON public.video_analyses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX video_analyses_user_created_idx ON public.video_analyses (user_id, created_at DESC);