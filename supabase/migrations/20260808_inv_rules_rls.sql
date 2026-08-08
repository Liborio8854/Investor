-- RLS pro inv_rules: authenticated může číst / vkládat / updatovat
ALTER TABLE inv_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inv_rules'
      AND policyname = 'Allow authenticated read inv_rules'
  ) THEN
    CREATE POLICY "Allow authenticated read inv_rules"
      ON inv_rules FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inv_rules'
      AND policyname = 'Allow authenticated insert inv_rules'
  ) THEN
    CREATE POLICY "Allow authenticated insert inv_rules"
      ON inv_rules FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'inv_rules'
      AND policyname = 'Allow authenticated update inv_rules'
  ) THEN
    CREATE POLICY "Allow authenticated update inv_rules"
      ON inv_rules FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
