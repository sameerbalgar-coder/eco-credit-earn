# Hotspot Map for Supervisor and Admin

A hotspot map already exists and both the Supervisor and Admin dashboards open it. Today it only groups plain waste reports into fixed grid circles, with no filters, no severity signal, and no way to act on a hotspot. Currently 11 reports exist and only 6 carry map coordinates, so the map also needs to say clearly how many reports it could not place.

## What will change

**One shared hotspot page, used by both Supervisor and Admin**
- Admin gets its own entry at an admin address so the page no longer borrows the supervisor link.

**Better hotspot detection**
- Group nearby reports into clusters and colour them by intensity: yellow (light), orange (busy), red (severe).
- Weight a hotspot higher when reports there are still unresolved or high-severity hazards, so genuinely problem areas stand out rather than areas that were already cleaned.

**Filters above the map**
- Time window: last 7 days, 30 days, all time.
- Status: open only (reported / in progress) or everything.
- Issue type: garbage, hazard, and the other report types.

**Richer hotspot details**
- Tapping a hotspot shows the report count, breakdown by type, how many are still open, the most recent report date, and the area name.
- A "View reports" action jumps to the assignment screen filtered to that area, so a supervisor can assign work straight from the map.

**Honest data reporting**
- A line under the map states how many reports have no location and are therefore not shown.
- Live updates: new reports appear on the map without a refresh.

**Ranked list below the map**
- Top areas ordered by intensity, each showing open vs. resolved counts and last activity, tappable to focus the map on that spot.

## Technical notes

- Extend `src/pages/SupervisorHotspotsPage.tsx` into a shared hotspots page consumed by both roles; register an `/admin/hotspots` route in `src/App.tsx` and point the Admin dashboard tile there.
- Query `waste_reports` for `id, waste_type, latitude, longitude, address, status, created_at`, plus severity fields where present, filtered by the selected time window; keep the Goa map bounds used elsewhere.
- Keep the existing grid-bucket clustering but score each bucket as a weighted sum (open reports weigh more than completed) and drive both circle radius and colour from that score.
- Subscribe to `waste_reports` inserts/updates through the existing realtime channel pattern used on other staff pages.
- No database changes are required.
