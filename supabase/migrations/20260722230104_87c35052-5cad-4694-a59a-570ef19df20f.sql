
CREATE TABLE public.metric_samples (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT,
  extra JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX metric_samples_user_metric_time_idx ON public.metric_samples (user_id, metric, recorded_at DESC);
CREATE INDEX metric_samples_user_time_idx ON public.metric_samples (user_id, recorded_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.metric_samples TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.metric_samples_id_seq TO authenticated;
GRANT ALL ON public.metric_samples TO service_role;
GRANT ALL ON SEQUENCE public.metric_samples_id_seq TO service_role;
ALTER TABLE public.metric_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own metric_samples" ON public.metric_samples FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.daily_metrics (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  metric TEXT NOT NULL,
  min_value DOUBLE PRECISION,
  avg_value DOUBLE PRECISION,
  max_value DOUBLE PRECISION,
  last_value DOUBLE PRECISION,
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_recorded_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day, metric)
);
CREATE INDEX daily_metrics_user_day_idx ON public.daily_metrics (user_id, day DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_metrics TO authenticated;
GRANT ALL ON public.daily_metrics TO service_role;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own daily_metrics" ON public.daily_metrics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.sleep_nights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  end_at TIMESTAMPTZ NOT NULL,
  day DATE NOT NULL,
  score INTEGER NOT NULL,
  asleep_min INTEGER NOT NULL,
  in_bed_min INTEGER NOT NULL,
  wakeups INTEGER NOT NULL DEFAULT 0,
  stages JSONB,
  debt_min INTEGER,
  hypnogram JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
CREATE INDEX sleep_nights_user_end_idx ON public.sleep_nights (user_id, end_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sleep_nights TO authenticated;
GRANT ALL ON public.sleep_nights TO service_role;
ALTER TABLE public.sleep_nights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sleep_nights" ON public.sleep_nights FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER sleep_nights_touch BEFORE UPDATE ON public.sleep_nights FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER daily_metrics_touch BEFORE UPDATE ON public.daily_metrics FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
