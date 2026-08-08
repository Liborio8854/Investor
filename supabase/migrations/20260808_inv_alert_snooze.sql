-- inv_alert_snooze: dočasné ztlumení ALERT doporučení per ticker
CREATE TABLE IF NOT EXISTS inv_alert_snooze (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  ticker text NOT NULL,
  snoozed_until date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, ticker)
);

ALTER TABLE inv_alert_snooze ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inv_alert_snooze'
      AND policyname = 'Allow authenticated read inv_alert_snooze'
  ) THEN
    CREATE POLICY "Allow authenticated read inv_alert_snooze"
      ON inv_alert_snooze FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inv_alert_snooze'
      AND policyname = 'Allow authenticated write inv_alert_snooze'
  ) THEN
    CREATE POLICY "Allow authenticated write inv_alert_snooze"
      ON inv_alert_snooze FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inv_alert_snooze'
      AND policyname = 'Allow authenticated update inv_alert_snooze'
  ) THEN
    CREATE POLICY "Allow authenticated update inv_alert_snooze"
      ON inv_alert_snooze FOR UPDATE
      TO authenticated
      USING (true);
  END IF;
END $$;
