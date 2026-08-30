# On-Demand Pickup for Citizens

Citizens can request a doorstep waste pickup, choose a date and time slot, and have it routed to a recycling partner. All requests are tracked on a new Pickups page.

## What the citizen does

1. Opens **Pickups** from the home Quick Actions (and a bottom-nav/route entry at `/pickups`).
2. Fills a short request form:
   - Waste type (same categories as reporting: plastic, organic, e-waste, metal, glass, paper, hazardous, mixed)
   - Preferred date (today or later) and time slot: Morning 8-12, Afternoon 12-4, Evening 4-8
   - Contact phone number (10-digit, validated)
   - Pickup address, with "Use my location" GPS and "Pick on map" (same Leaflet picker as the report form)
   - Optional estimated weight and notes
   - Optional photo
3. Chooses a recycling partner: the form suggests partners from the existing recycling directory (household/business, nearest first when GPS is available); the citizen can also leave it as "Any available partner".
4. Submits and sees a confirmation with a short request ID.

## Tracking

The Pickups page has two sections:
- **Upcoming** — requested / confirmed / on the way
- **History** — completed and cancelled

Each card shows waste type, date + slot, address, assigned partner with tap-to-call and email links, and a colored status chip (Requested = amber, Confirmed = blue, Completed = green, Cancelled = gray). Citizens can cancel a request while it is still Requested or Confirmed. Status changes stream in live.

## Routing to partners

- On submit, the request is stored with the selected partner (or none).
- Supervisors and admins can see all pickup requests, set the partner, and move the status forward; supervisors get a notification for each new request so nothing sits unhandled. This uses the existing notification mechanism.
- The partner's phone/email from the recycling directory is shown to the citizen so they can contact them directly.

## Technical notes

- New table `public.pickup_requests`: `user_id`, `waste_type`, `preferred_date` (date), `time_slot` (text: morning/afternoon/evening), `contact_phone`, `address`, `latitude`, `longitude`, `quantity_kg`, `notes`, `photo_url`, `contact_id` (FK to `recycling_contacts`), `status` (enum: requested, confirmed, on_the_way, completed, cancelled), plus `created_at`/`updated_at` with the existing `update_updated_at` trigger.
- Grants: `SELECT, INSERT, UPDATE` to `authenticated`, `ALL` to `service_role`. RLS: citizens read/insert/update their own rows; supervisors and admins read and update all rows (via `has_role`).
- Realtime enabled on the table; the Pickups page subscribes to changes for the signed-in user.
- Photos reuse the existing public `report-photos` bucket under a `pickups/` prefix.
- Client validation with zod: phone `^[0-9]{10}$`, date not in the past, address max 200 chars, notes max 500 chars, weight positive.
- New files: `src/pages/PickupsPage.tsx` (list + form, mobile-first, existing card/earthy style), route `/pickups` in `App.tsx`, Quick Action tile on `Index.tsx`, and a supervisor-side pickup list added to the supervisor dashboard actions.
- Notifications on new request go to supervisors via the existing `notify_role` function.
