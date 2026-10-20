/*
# Add flagged_at column to waste_reports

1. Modified Tables
- `waste_reports` — adds `flagged_at` (timestamptz, nullable) to record when a supervisor flagged a report as fake.

2. Security
- No RLS or policy changes. Existing policies remain in effect.
*/

ALTER TABLE waste_reports ADD COLUMN IF NOT EXISTS flagged_at timestamptz;
