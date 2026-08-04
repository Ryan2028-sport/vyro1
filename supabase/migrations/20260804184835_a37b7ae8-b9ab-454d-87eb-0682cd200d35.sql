CREATE TABLE public.band_debug_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  kind TEXT NOT NULL DEFAULT 'full',
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX band_debug_snapshots_user_created_idx ON public.band_debug_snapshots (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.band_debug_snapshots TO authenticated;
GRANT ALL ON public.band_debug_snapshots TO service_role;
ALTER TABLE public.band_debug_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own debug snapshots" ON public.band_debug_snapshots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);