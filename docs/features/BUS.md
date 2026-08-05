# Bus Tracking

School bus arrival predictions on the dashboard, with adaptive polling that ramps from 60s down to 5s as the bus approaches. Works by parsing the geofence-notification emails that **FirstView** (the bus-tracking service used by many North American school districts) sends to your Gmail inbox.

If your district uses FirstView, you can have your dashboard show "Bus 4 minutes away" without installing the FirstView app or constantly checking your phone.

---

## How it works (at a glance)

1. You connect Gmail in *Settings → Bus Tracking → Gmail Connection*.
2. You configure one or more **bus routes**: each route is a student + AM/PM trip + ordered geofence checkpoints.
3. Prism polls Gmail for new FirstView emails, parses them, and updates each route's state (next checkpoint, ETA, status).
4. The dashboard widget shows the status in real time. As the bus gets closer, polling interval shrinks so the ETA stays accurate.

---

## Setup

### 1. Connect Gmail

*Settings → Bus Tracking → Gmail Connection → Connect.*

OAuth flow. Prism requests read-only access to your Gmail (specifically: `gmail.readonly` scope). It doesn't send mail, doesn't modify labels, doesn't delete anything. The only thing it does is list + read messages matching the bus filter.

### 2. Auto-discover routes

*Settings → Bus Tracking → Discover from Emails.*

This scans your existing Gmail for FirstView emails (up to the most recent ~100 FirstView emails in your mailbox) and **creates any new routes it finds** in one click. Routes with a trip ID + direction you already have are skipped. Each created route captures:

- The FirstView trip ID (e.g. "28-C").
- The direction (AM / PM).
- The student name parsed from the email.

Edit or delete any routes you don't want afterward. Created routes go into your `bus_routes` table.

### 3. Configure each route

For each route, set:

- **Student name**: what to display ("Emma", not just "Trip 28-C").
- **Family member**: optional link to a Prism user; lets the widget filter to one kid.
- **Home ETA**: expected arrival time at your stop, HH:mm format (e.g. `07:42`).
- **Checkpoints**: ordered list of geofence labels you want to display. The emails reference checkpoint names from FirstView's geofencing setup; you list the ones you care about (e.g. "Bus barn", "Maple & 3rd", "Pine Grove").
- **Your Stop**: a dropdown that picks which of your listed checkpoints is your stop; it becomes the ETA target for the arrival prediction.
- **School name**: the school. Implicit final checkpoint for AM, starting checkpoint for PM.

Active days default to Mon–Fri (`[1,2,3,4,5]`) and are not currently editable in the route dialog.

### 4. Optional: Gmail label filter

If you have a Gmail filter that routes FirstView emails to a label and skips the inbox (e.g. a `bus` label), tell Prism which label to read from in *Settings → Bus Tracking → Gmail label*.

Defaults to scanning all mail. If you have a noisy inbox, the label filter speeds up sync.

---

## The dashboard widget

The BusTracker widget shows one row per route. Each row has:

- **Route label + Home ETA time.**
- **Checkpoint progress dots**: one dot per checkpoint, filled in as the bus crosses each geofence.
- **Status color**:
  - **Gray**: before activation (route is enabled but the bus hasn't started moving for today's trip).
  - **Amber**: bus is moving, on the way.
  - **Green**: bus arrived at your stop (AM: arrived at school; PM: arrived at your stop).
  - **Red**: overdue (past the scheduled time with no arrival).
- **ETA text**: "~4 min away" / "3–5 min away" / "Arrived at stop" / "Arrived at school" / "Overdue: no updates".

When 6+ checkpoints exist, the progress dots wrap into a 2-row layout that follows reading order: top row L→R, bottom row L→R, joined by a U-turn connector on the right, so the widget doesn't sprawl horizontally.

### On the screensaver

The same Bus Tracker widget can be placed on the screensaver canvas (it's hidden by default). It renders the full train-map widget, not a separate simplified variant. Handy when a kid's checking the wall display before walking out the door.

---

## Adaptive polling

The pulse rate adapts based on how close the bus is:

- **Default / no checkpoint yet:** 60 seconds.
- **ETA >10 minutes out:** 30 seconds.
- **ETA 5–10 minutes:** 15 seconds.
- **ETA 3–5 minutes:** 10 seconds.
- **ETA ≤3 minutes:** 5 seconds.

Outside the route's ±60-minute display window, polling is disabled entirely (interval 0). It isn't merely slowed. Note that a route that has already **arrived** keeps a slow 30-second poll until it leaves that ±60-minute window; it does not pause on arrival.

Polling pauses entirely when:

- It's not an active day for any route (weekend, holiday). Nothing is within the ±60-minute window.
- The browser tab is hidden, paused via `useVisibilityPolling`. Resumes when the tab is foregrounded.

The visibility pause is important: without it, an open dashboard tab would poll Gmail every 10 seconds indefinitely, which the Gmail API quota doesn't appreciate.

---

## Email parsing

FirstView sends three notification types per trip:

1. **Distance-based**: "Bus is 2 miles away." Contains a distance + ETA estimate.
2. **Arrived at stop**: "Bus has arrived at your stop." Sent when the bus crosses the stop geofence.
3. **Arrived at school**: "Bus has arrived at school." Sent when the bus crosses the school geofence (AM trip).

The parser extracts:

- **Event type** (one of the three above).
- **Checkpoint name**: which geofence was crossed (matches the configured `checkpoints` for that route).
- **Event time**: from the email's `Date:` header (timezone-correct; the body text uses naive local times that broke in UTC Docker containers before v1.3).
- **Trip date**: derived from event time + active day check.
- **Gmail message ID**: for dedup. The `bus_geofence_log` table has a unique index on `gmail_message_id` so reprocessing a message twice is a no-op.

### Fuzzy checkpoint matching

FirstView's checkpoint names can drift: "Maple & 3rd" might show up as "Maple and 3rd", "Maple/3rd", or just "Maple 3rd" across different emails. The parser does fuzzy matching against your configured checkpoint list so minor variations match cleanly.

### Historical median transit times

Once you have a few weeks of data, the system calculates a **rolling 30-day median** transit time between consecutive checkpoints. This is what powers the "8 min ETA" prediction even before the distance-based email arrives.

If the median for `Pine Grove → Our stop` is 4 minutes, and the bus just crossed Pine Grove at 7:38, the widget shows "Bus 4 minutes away" predicted-arrival-7:42. Updates instantly when the actual arrival email comes in.

---

## Status states

Each route walks through these states per trip:

1. **Pre-activation** (gray): before the first email of the day arrives. Polls slowly.
2. **In transit** (amber): at least one email has arrived; bus is between checkpoints.
3. **Approaching** (amber, fast polling): within 3-5 minutes of predicted arrival.
4. **Arrived** (green): final email received. AM: at school. PM: at your stop.
5. **Overdue** (red): past the scheduled arrival time + 30 minute grace, with no arrival email.

The overdue state intentionally has a grace window: buses run a few minutes late routinely, and you don't want a false alarm every Tuesday.

---

## Active days awareness

Without any notion of active days, the widget would flag "overdue" every weekend morning (no bus, no email, so the predicted arrival never happens). Routes default to active Mon–Fri (`[1,2,3,4,5]`), so the widget shows neutral "off duty" status on weekends and any non-active day.

Active days aren't currently editable from the route dialog, so routes that only run on certain days (e.g. Tue/Thu after-school enrichment) still use the Mon–Fri default for now.

---

## Privacy

Bus tracking is your data, on your instance. The only external service involved is Gmail. Prism's read-only access lets it parse the FirstView emails you already receive.

- Gmail OAuth tokens are stored AES-256-GCM encrypted at rest.
- Parsed email bodies are not stored verbatim; only the structured fields (checkpoint, event time, event type) plus the Gmail message ID for dedup.
- Disconnect anytime: *Settings → Bus Tracking → Gmail Connection → Disconnect*. Tokens are deleted; existing bus tracking data stays in your DB but stops updating.

---

## Common workflows

### Weekday-morning rush

Set up AM routes for each kid. Open the dashboard at 7am. Widget walks through the checkpoints as the bus approaches. When it shows "2 minutes away" you know to start the shoes-and-coats hustle.

### Coordinating two kids on different buses

Two routes, different trip IDs, different students. Widget shows both as separate rows.

### After-school confirmation

PM routes start polling around dismissal. Green "Arrived at school" → amber "in transit" → green "Arrived at your stop" → time to look up from work to greet the kid.

### Late bus / snow day diagnostic

When the bus is late, the widget shows what happened: which checkpoints were crossed (you can see if the bus actually started) and how long ago. Helps distinguish "running 10 min late" from "the bus broke down" without calling the district.

---

## Troubleshooting

### "Bus tracker shows nothing"

Most common cause: no FirstView emails in your inbox yet for today. The widget activates when the first email of the day arrives. Check Gmail directly: do you see today's emails?

If yes but Prism doesn't, check:

1. *Settings → Bus Tracking → Gmail Connection*: still connected?
2. *Settings → Bus Tracking → Gmail label*: is the label filter correct? (If your filter routes to a `bus` label, the default "scan all mail" might not find them either, but the label-specific scan would.)
3. Force a sync: *Settings → Bus Tracking → Sync now.*

### Route auto-discovery missed a trip

Discovery scans up to the most recent ~100 FirstView emails in your mailbox. If your district just added a new trip (or you forwarded existing emails to Gmail recently), the discovery might miss them. Manually add the route in *Settings → Bus Tracking → Add Route* using the trip ID + direction.

### Checkpoint progress dots don't fill in

The checkpoint names must match (fuzzily) what FirstView sends. If a checkpoint never fills, check the parsed `bus_geofence_log` rows: what `checkpoint_name` did Prism actually parse? Update your `checkpoints` config to match.

### "Overdue" status on weekends

Routes default to active Mon–Fri (`[1,2,3,4,5]`), so weekends should already show as off-duty. Active days aren't editable from the route dialog today; if a route's schedule differs from the Mon–Fri default, that's a current limitation rather than a setting to change.

### ETA shows "925m" or other huge value

Was a bug in older versions: large minute values weren't being converted to "h m" format. Fixed in v1.3. Should now show "15h 25m". Hard-reload if you still see raw minutes.

### Gmail rate-limited

Gmail's API has a generous quota but it's not infinite. The visibility-pause + adaptive polling combo keeps quota usage well under the limit for one family on one Gmail account. If you somehow hit the limit (e.g. multiple dashboards polling the same account from different tabs), Gmail returns 429 and Prism backs off. Sync resumes after a cooldown.

### "Bus at school" shows 0-minute ETA at pickup time

Was an old display bug where PM routes showed "0 min" before the bus left school instead of "at school, en route." Fixed. Now shows "Bus at school, en route."

### Arrival timestamps were off by 6 hours

Was a TZ bug in early v1.3: arrival parsers were parsing the email body's text time as naive UTC instead of the email's `Date:` header (which is timezone-aware). Fixed. If you see this on old data, it'll correct itself for new arrivals; historical rows can be re-parsed by deleting and re-syncing.
