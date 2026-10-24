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

## Live tracking from a position provider

Prism can also take live bus positions from a **position provider**: a small program you run that reads positions from your bus service and posts them to Prism. Prism does not include a provider for any particular vendor. It defines the format, stores what arrives, and keeps the history.

While a linked trip is running, the Bus Tracker widget fills with a map of the bus moving along today's route, each upcoming stop labelled with its projected time. A card in the map's corner shows the arrival time at your stop, how late the bus is running, how many stops are done and when the last update arrived; from 480 x 360 px it also shows the next stop, the bus and the driver. Below 200 x 240 px the widget shows the card alone, with no map. With no live data, the widget shows the route's scheduled time as before.

Projected times start from the provider's planned stop times, moved by how late or early the bus reached its most recent stop. Before the first stop, the start of the trip sets it: a bus that leaves the depot late, or is still parked past its planned start, moves every stop later at once, since a late start is seldom made up. They never show a time earlier than now.

From the bus's last reported position, a dashed line shows the road still to come, along the route as the bus drove it on its last trip (mornings and afternoons each follow their own). Between reports the marker moves along that line, so it turns where the road turns, and the solid line takes over the dashes as each new position arrives. Before there is an earlier trip it joins the remaining stops with straight lines. The solid line behind the bus is only positions it actually reported.

Positions arrive every few seconds and are already a little old when they do, so the marker shows where the bus most likely is now rather than where it last reported: it carries on along the last heading, easing off the longer it goes without an update, for up to 20 seconds, never past the next stop, and not at all while the bus is stopped or its doors are open. It never slides backwards for a small correction: if the next update is a little behind it, the marker waits up to 10 seconds for the bus to come level, then backs up gently if it has to. A real turnaround moves it at once. Showing the bus behind where it really is would suggest there is more time than there is. After 90 seconds with no update the marker fades.

### Setup

1. *Settings → Bus Tracking → Live Tracking → Create provider token.* The token has the `bus:ingest` scope, so it can post positions and do nothing else. It is shown once.
2. Point your provider at `https://<your-prism>/api/bus-tracking/live/ingest` with the header `Authorization: Bearer <token>`.
3. Optionally pick the map's look under *Map style* (Simple, plain grey streets, is the default; Detailed adds coloured roads and parks) and what it shows under *Camera*: *Follow* frames the bus and your stop and zooms in as it approaches, and *Whole route* keeps the full trip in view. The camera moves only when the bus nears the edge or the view can close in a whole zoom level, so it is not always zooming. The map turns dark with Prism's theme. Its + and - buttons zoom by hand; the camera takes over again a minute later. The bus shows as a beacon: a dot with a cone pointing the way it is heading, pulsing while its position is live. Speed shows in mph or km/h following *Settings → Display → Units*.
4. Once a provider reports drivers, *Drivers this week* lists them. Type how each should appear on the display (say "Mr. Lastname"); wide widgets read "Today's driver: Mr. Lastname". Prism never picks a title itself, and a blank entry shows the name as reported.
5. Once the provider sends today's trips, they appear under *Trips reported this week*. Pick the route each one belongs to. Prism remembers the trip's provider, label and direction, so the next day's trip links itself.

### The format

One JSON body, any mix of four parts. A provider normally sends `tracks` once in the morning and again when something changes, then a `fixes` entry for each position:

```json
{
  "provider": "my-provider",
  "tracks": [{
    "key": "any-stable-id-for-today", "date": "2026-03-02", "direction": "AM", "label": "Route 7",
    "vehicle": { "number": "14", "color": "Yellow", "driverName": "Sam Example" },
    "stops": [{ "key": "s1", "order": 0, "lat": 39.7392, "lng": -104.9903, "plannedAt": "2026-03-02T07:31:00-07:00", "kind": "stop", "rider": true }]
  }],
  "fixes": [{ "track": "any-stable-id-for-today", "eventId": "e1", "ts": "2026-03-02T07:29:40-07:00",
              "lat": 39.7390, "lng": -104.9910, "heading": 90, "speed": 8.5, "moving": true, "doorOpen": false }],
  "stopEvents": [{ "track": "any-stable-id-for-today", "stop": "s1", "kind": "arrived", "at": "2026-03-02T07:31:20-07:00" }],
  "progress": [{ "track": "any-stable-id-for-today", "lastVisitedStop": 1, "totalStops": 5 }]
}
```

- `key` is yours to choose. It only has to stay the same for the day; Prism never needs to know what it stands for.
- `ts` is when the bus was there, with a time zone. Fixes can arrive late or out of order. One stamped more than five minutes in the future is dropped.
- Sending the same `eventId` twice stores it once, so a provider can safely retry.
- `heading` is degrees clockwise from north; `speed` is metres per second.
- `rider: true` marks your stop, the one the widget gives an arrival time for. Without it, the stop whose name matches the route's *Stop name* is used, and failing that the last stop.

The full schema is `src/lib/validations/liveVehicle.ts`. `scripts/fake-bus-provider.ts` plays a made-up trip into a Prism instance and is the reference example of a provider:

```bash
PRISM_URL=http://localhost:3000 PRISM_INGEST_TOKEN=<token> npx tsx scripts/fake-bus-provider.ts --speed 20
```

### How long it is kept

Two settings under *Live Tracking → Keep history*:

- **Exact route**, 30 days by default: every position, which is where the bus was minute by minute.
- **Stop times**, 365 days by default: when the bus reached and left each stop, one summary per trip, and the arrival-time checks below. This is what arrival predictions learn from.

Each day, before anything is deleted, every trip from the day before is summarised: whether it ran all the way, only partly, or not at all, how many stops it reached and how many it passed without opening the doors, when it started and finished, the bus number, the weather, and the driver as a code that tells drivers apart without keeping a name. A day with no bus (a weekend, a holiday, a snow day) has no summary at all, and a trip that was reported but never ran is marked as not run. Neither is ever counted as a trip that took no time.

A daily job deletes anything older. Both stay on your server.

### Arrival time accuracy

While a trip runs, the arrival time shown for your stop is saved at 20, 15, 10, 5 and 2 minutes out, and compared with when the bus actually got there. *Live Tracking → Arrival time accuracy* shows, for each lead time, the typical miss, the margin four trips in five land within, and which way it leans (a bus that tends to come later or earlier than shown). Only trips that reached your stop are scored; a lead time shows once it has three.

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
