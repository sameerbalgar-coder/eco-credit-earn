/*
# Add captured_at to waste_reports

## Purpose
Store the exact moment a citizen captured their waste photo as a dedicated
timestamp field, separate from the free-text description. This supports the
image verification workflow that watermarks capture time and GPS coordinates
onto photos.

## Changes
1. `waste_reports` table
   - `captured_at` (timestamptz, nullable) — when the photo was taken, from
     EXIF DateTimeOriginal when available, otherwise the browser's capture
     time. Populated by the report submission flow.

## Security
- No new policies needed. Existing INSERT/UPDATE policies on `waste_reports`
  already cover the reporter and authorized staff.
*/

ALTER TABLE public.waste_reports
  ADD COLUMN IF NOT EXISTS captured_at timestamptz;
