-- inv_recommendations: denní Gemini doporučení
CREATE TABLE IF NOT EXISTS inv_recommendations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  date date NOT NULL,
  type text NOT NULL,
  ticker text,
  price numeric,
  message text,
  priority integer DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inv_recommendations_date_idx ON inv_recommendations (date DESC);

ALTER TABLE inv_recommendations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inv_recommendations'
      AND policyname = 'Allow authenticated read inv_recommendations'
  ) THEN
    CREATE POLICY "Allow authenticated read inv_recommendations"
      ON inv_recommendations FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
