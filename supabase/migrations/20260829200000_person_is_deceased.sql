ALTER TABLE people
  ADD COLUMN IF NOT EXISTS is_deceased boolean NOT NULL DEFAULT false;

UPDATE people SET is_deceased = true WHERE death_date IS NOT NULL;
