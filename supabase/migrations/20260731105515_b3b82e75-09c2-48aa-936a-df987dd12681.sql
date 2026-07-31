CREATE TABLE public.training_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  time_label text NOT NULL DEFAULT 'TBD',
  title text NOT NULL,
  load_label text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'green',
  sport text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plan_items TO authenticated;
GRANT ALL ON public.training_plan_items TO service_role;

ALTER TABLE public.training_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own training_plan_items" ON public.training_plan_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX training_plan_items_user_day_idx ON public.training_plan_items (user_id, day);

CREATE TRIGGER training_plan_items_touch
  BEFORE UPDATE ON public.training_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();