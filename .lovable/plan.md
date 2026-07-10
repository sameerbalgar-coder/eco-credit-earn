## Goal
Give supervisors a clear pipeline: see citizen reports → assign to a worker → see who's on it → view proof once done.

## Changes

### 1. Upgrade `SupervisorAssignPage` into a full Reports Board
Split into 3 tabs (or stacked sections): **Pending**, **In Progress**, **Completed**.

- **Pending** — waste reports with status `pending` (unassigned). Tap a report → opens a bottom sheet with report details (photo, waste type, address, reporter name, time) and a worker picker. Assign creates the task + notifies worker (existing logic).
- **In Progress** — reports with status `assigned` / `in_progress`. Each card shows:
  - Report info (waste type, address, thumbnail)
  - Assigned worker name + avatar
  - Task status badge (assigned / started / in progress)
  - "Reassign" button (optional secondary action)
- **Completed** — reports with status `completed`. Each card shows:
  - Worker name
  - "View Proof" button → opens a modal with **before photo**, **after photo**, completion notes, weight collected, completed timestamp, GPS pin link.

### 2. New `SupervisorReportDetail` modal/route
Reusable detail view showing full report + associated task info. Used from both the "In Progress" and "Completed" tabs. Photo lightbox on tap (same pattern as feed).

### 3. `SupervisorDashboard` tweaks
- Pending Reports cards now show assigned worker name when status is `assigned`.
- Add a 4th quick stat: **Awaiting Verification** (completed but not yet verified by admin).

### 4. Data fetching
Single query joining `waste_reports` with `tasks` and `profiles` (via `worker_id`) so we get worker `display_name` in one round-trip. Realtime subscription on `tasks` so status flips (assigned → completed) update the board live.

### Extra suggestions (say yes/no)
- **Priority flag** on reports (low/medium/high) so supervisor can triage.
- **Bulk assign** — pick multiple pending reports, assign to one worker.
- **Verify & release credits** button on the Completed card, so the supervisor approves proof before credits are paid out to the worker (currently that seems to sit with admin).
- **Chat / note thread** per task between supervisor and worker.
- **Filter by zone** so supervisors only see reports in their assigned zone.

## Files touched
- `src/pages/SupervisorAssignPage.tsx` — rebuild as tabbed board
- `src/pages/SupervisorDashboard.tsx` — show assigned worker names, add stat
- `src/pages/SupervisorReportDetail.tsx` — new proof-viewer modal/page
- `src/App.tsx` — route for the new detail page (if standalone)

No schema changes needed — `tasks.before_photo_url`, `after_photo_url`, `completion_notes`, `weight_kg`, `completed_at` already exist.