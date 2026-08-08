-- Rename legacy DIP year target key → default for 2027+.
-- Prefer keeping dip_year_target_default if both keys already exist.
DELETE FROM inv_rules
WHERE key = 'dip_year_target_2027'
  AND EXISTS (
    SELECT 1 FROM inv_rules d WHERE d.key = 'dip_year_target_default'
  );

UPDATE inv_rules
SET
  key = 'dip_year_target_default',
  description = 'DIP roční cíl 2027+ (Kč)'
WHERE key = 'dip_year_target_2027';

UPDATE inv_rules
SET description = 'DIP roční cíl 2027+ (Kč)'
WHERE key = 'dip_year_target_default'
  AND (description IS NULL OR description IS DISTINCT FROM 'DIP roční cíl 2027+ (Kč)');
