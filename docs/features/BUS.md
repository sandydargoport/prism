# School bus

See on the wall when the school bus is coming. This works if your district uses FirstView.

Prism reads the arrival emails FirstView sends to your Gmail and shows "Bus 4 minutes away" on the screen, so nobody needs to keep checking the app. It checks more often as the bus gets close.

## Set it up

### Setup

#### 1. Connect Gmail

Go to *Settings → Bus Tracking → Gmail Connection → Connect.*

This opens Google's sign-in (OAuth, the standard way to grant an app access without giving it your password). Prism asks for read-only access to your Gmail, the `gmail.readonly` scope. It doesn't send mail, change labels or delete anything. All it does is list and read the messages that match the bus filter.

#### 2. Auto-discover routes

Go to *Settings → Bus Tracking → Discover from Emails.*

Prism looks through your Gmail for FirstView emails (up to the latest 100 or so) and creates every new route it finds in one click. It skips any route whose trip ID and direction you already have. Each new route gets:

- the FirstView trip ID (for example "28-C")
- the direction (AM or PM)
- the student name read from the email.

Edit or delete the routes you don't want afterwards. New routes are saved in your `bus_routes` table.

#### 3. Configure each route

For each route, set:

- **Student name**: the name to show, such as "Emma", in place of a bare "Trip 28-C".
- **Family member**: an optional link to a Prism user, so the widget can show one child's bus only.
- **Home ETA**: when the bus is due at your stop, in HH:mm (for example `07:42`).
- **Checkpoints**: the geofence labels you want to show, in order. A geofence is a zone FirstView draws on the map, and its emails name the zone the bus just entered. You list the ones you care about, such as "Bus barn", "Maple & 3rd" and "Pine Grove".
- **Your Stop**: a dropdown to choose which of your checkpoints is your stop. The arrival prediction counts down to it.
- **School name**: the school, which counts as the last checkpoint in the morning and the first in the afternoon.

Active days are Mon to Fri by default (`[1,2,3,4,5]`), and you can't change them in the route dialog yet.

#### 4. Optional: Gmail label filter

If a Gmail filter sends FirstView emails to a label and skips the inbox (a `bus` label, say), tell Prism which label to read in *Settings → Bus Tracking → Gmail label*.

By default Prism searches all mail. With a busy inbox, the label filter makes sync faster.

### Active days awareness

Without active days the widget would flag "overdue" every weekend morning, since no bus means no email and the predicted arrival never comes. Routes are active Mon to Fri (`[1,2,3,4,5]`) by default, so on weekends and any other inactive day the widget shows a neutral "off duty".

You can't edit active days in the route dialog yet, so a route that runs only on some days (Tue and Thu after-school clubs, for example) still uses the Mon to Fri default for now.

### Live tracking from a position provider

Prism can also take live bus positions from a position provider: a small program you run that reads positions from your bus service and posts them to Prism. Prism ships no provider for any particular vendor. It sets the format, stores what arrives and keeps the history.

While a linked trip is running, the Bus Tracker widget fills with a map of the bus moving along today's route, with each stop ahead labelled with its projected time. A card in the map's corner shows the arrival time at your stop, how late the bus is running, how many stops are done and when the last update came in. From 480 x 360 px it also shows the next stop, the bus and the driver. Below 200 x 240 px the widget shows only the card, with no map. When there is no live data, the widget shows the route's scheduled time as before.

Projected times start from the provider's planned stop times, shifted by how late or early the bus reached its latest stop. Before the first stop, the start of the trip sets the shift: a bus that leaves the depot late, or is still parked after its planned start, moves every stop later at once, because a bus seldom makes up a late start. A projected time is never earlier than now.

From the bus's last reported position, a dashed line shows the road still ahead, following the way the bus drove it on its last trip (mornings and afternoons each have their own). Between reports the marker moves along that line, so it turns where the road turns, and the solid line replaces the dashes as each new position comes in. Until there is an earlier trip to follow, the line joins the remaining stops in straight lines. The solid line behind the bus is made only of positions it really reported.

Positions come every few seconds and are already a little old when they arrive, so the marker shows where the bus most likely is now. It keeps going along the last heading, slowing the longer there is no update, for up to 20 seconds. It never goes past the next stop, and it stays put while the bus is stopped or its doors are open. It doesn't jump backwards for a small correction: if the next update is a little behind it, the marker waits up to 10 seconds for the bus to catch up, then backs up gently if it must. A real turnaround moves it at once. Showing the bus behind where it really is would suggest you have more time than you do. After 90 seconds with no update the marker fades.

#### Setup

1. Go to *Settings → Bus Tracking → Live Tracking → Create provider token.* The token has the `bus:ingest` scope, which lets it post positions and nothing else. Prism shows it only once.
2. Point your provider at `https://<your-prism>/api/bus-tracking/live/ingest` with the header `Authorization: Bearer <token>`.
3. If you like, choose the map's look under *Map style*: Simple (plain grey streets) is the default, and Detailed adds coloured roads and parks. Choose what it shows under *Camera*: *Follow* frames the bus and your stop and zooms in as the bus gets near, and *Whole route* keeps the whole trip in view. The camera moves only when the bus nears the edge or the view can zoom in a whole level, so it isn't zooming all the time. The map goes dark with Prism's theme. Its + and - buttons zoom by hand, and the camera takes over again a minute later. The bus shows as a beacon, a dot with a cone pointing the way it is heading, which pulses while its position is live. Speed shows in mph or km/h, following *Settings → Display → Units*.
4. Once a provider reports drivers, *Drivers this week* lists them. Type how each one should appear on the display (say "Mr. Lastname"), and wide widgets read "Today's driver: Mr. Lastname". Prism never chooses a title itself, and if you leave the entry blank it shows the name as reported.
5. Once the provider sends today's trips, they appear under *Trips reported this week*. Pick the route each one belongs to. Prism remembers the trip's provider, label and direction, so the next day's trip links itself.

#### The format

A provider posts one JSON body containing any mix of four parts. It normally sends `tracks` once in the morning and again when something changes, then a `fixes` entry for each position:

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

- You choose `key`. It only has to stay the same for the day, and Prism never needs to know what it means.
- `ts` is when the bus was there, with a time zone. Fixes can arrive late or out of order. Prism drops any fix stamped more than five minutes in the future.
- If the same `eventId` arrives twice, Prism stores it once, so a provider can retry safely.
- `heading` is degrees clockwise from north, and `speed` is metres per second.
- `rider: true` marks your stop, the one the widget gives an arrival time for. Without it, Prism uses the stop whose name matches the route's *Stop name*, and failing that the last stop.

The full schema is in `src/lib/validations/liveVehicle.ts`. `scripts/fake-bus-provider.ts` plays a made-up trip into a Prism instance and serves as the reference provider:

```bash
PRISM_URL=http://localhost:3000 PRISM_INGEST_TOKEN=<token> npx tsx scripts/fake-bus-provider.ts --speed 20
```

#### How long it is kept

There are two settings under *Live Tracking → Keep history*:

- **Exact route**, 30 days by default: every position, which is where the bus was minute by minute.
- **Stop times**, 365 days by default: when the bus reached and left each stop, one summary per trip, and the arrival-time checks described below. Arrival predictions learn from this.

Each day, before anything is deleted, Prism summarises every trip from the day before: whether it ran all the way, only partly or not at all, how many stops it reached, how many it passed without opening the doors, when it started and finished, the bus number, the weather, and the driver as a code that tells drivers apart without keeping a name. A day with no bus (a weekend, a holiday, a snow day) gets no summary, and a trip that was reported but never ran is marked as not run. Neither ever counts as a trip that took no time.

A daily job deletes anything older than these limits. Both kinds of history stay on your server.

#### Arrival time accuracy

While a trip runs, Prism saves the arrival time it is showing for your stop at 20, 15, 10, 5 and 2 minutes out, and later compares each with when the bus really got there. *Live Tracking → Arrival time accuracy* shows, for each of those lead times, the typical miss, the margin that four trips in five land within, and which way it leans (whether the bus tends to come later or earlier than shown). Only trips that reached your stop are scored, and a lead time appears once it has three.

## Use it

### The dashboard widget

The BusTracker widget shows a row for each route. Each row has:

- **Route label + Home ETA time.**
- **Checkpoint progress dots**: a dot for each checkpoint, filled in as the bus enters its geofence.
- **Status color**:
  - **Gray**: not started yet (the route is on, but the bus hasn't set off on today's trip).
  - **Amber**: the bus is on its way.
  - **Green**: the bus has arrived (in the morning at school, in the afternoon at your stop).
  - **Red**: overdue, past the scheduled time with no arrival.
- **ETA text**: "~4 min away", "3 to 5 min away", "Arrived at stop", "Arrived at school" or "Overdue: no updates".

With six or more checkpoints, the dots wrap onto two rows that read in order, left to right on the top row and then left to right on the bottom row, joined by a U-turn on the right. This keeps the widget from getting too wide.

#### On the screensaver

You can also put the Bus Tracker widget on the screensaver canvas (it's hidden there by default). It shows the same full train-map widget, with no cut-down version. It helps when a child checks the wall display on the way out of the door.

### Status states

Each route goes through these states on every trip:

1. **Pre-activation** (gray): before the day's first email arrives. Prism checks slowly in this state.
2. **In transit** (amber): at least one email has come in, and the bus is between checkpoints.
3. **Approaching** (amber, checked often): 3 to 5 minutes from the predicted arrival.
4. **Arrived** (green): the final email has arrived. In the morning that means at school, in the afternoon at your stop.
5. **Overdue** (red): 30 minutes past the scheduled arrival with no arrival email.

The 30-minute grace is deliberate. Buses often run a few minutes late, and you don't want a false alarm every Tuesday.

### Common workflows

#### Weekday-morning rush

Set up a morning route for each child and open the dashboard at 7am. The widget moves through the checkpoints as the bus comes closer, and when it says "2 minutes away" it's time for shoes and coats.

#### Coordinating two kids on different buses

Add two routes with their own trip IDs and students, and the widget shows each on its own row.

#### After-school confirmation

Afternoon routes start checking around dismissal. The row goes from green "Arrived at school" to amber "in transit" to green "Arrived at your stop", and that's your cue to look up from work and greet your child.

#### Late bus / snow day diagnostic

When the bus is late, the widget shows which checkpoints it has passed (so you can see whether it set off at all) and how long ago. That helps you tell "running 10 minutes late" from "the bus broke down" without phoning the district.

## Details

### How it works (at a glance)

1. You connect Gmail in *Settings → Bus Tracking → Gmail Connection*.
2. You set up one or more bus routes. Each route is a student, a morning or afternoon trip, and an ordered list of geofence checkpoints.
3. Prism checks Gmail for new FirstView emails, reads them, and updates each route's next checkpoint, ETA and status.
4. The dashboard widget shows the status as it changes. As the bus gets closer, Prism checks more often so the ETA stays accurate.

### Adaptive polling

How often Prism checks (polls) Gmail depends on how close the bus is:

- **Default / no checkpoint yet:** 60 seconds.
- **ETA >10 minutes out:** 30 seconds.
- **ETA 5 to 10 minutes:** 15 seconds.
- **ETA 3 to 5 minutes:** 10 seconds.
- **ETA ≤3 minutes:** 5 seconds.

Outside the route's window of 60 minutes either side of its time, Prism stops checking completely (interval 0). A route that has already arrived keeps checking slowly, every 30 seconds, until it leaves that window; it doesn't stop on arrival.

Checking also stops completely when:

- no route is active today (a weekend or holiday), so nothing falls inside the 60-minute window
- the browser tab is hidden. `useVisibilityPolling` pauses it, and it starts again when the tab is back in front.

The pause for hidden tabs matters. Without it, a dashboard tab left open would check Gmail every 10 seconds forever, which would eat into the Gmail API quota.

### Email parsing

FirstView sends three kinds of notice for each trip:

1. **Distance-based**: "Bus is 2 miles away." It has a distance and an estimated arrival.
2. **Arrived at stop**: "Bus has arrived at your stop." Sent when the bus enters the stop's geofence.
3. **Arrived at school**: "Bus has arrived at school." Sent when the bus enters the school's geofence (morning trip).

From each email Prism reads:

- **Event type** (one of the three above).
- **Checkpoint name**: the geofence the bus entered, matched against the route's `checkpoints`.
- **Event time**: taken from the email's `Date:` header, which carries the right time zone. The body text gives local times with no time zone, and before v1.3 those came out wrong in Docker containers running on UTC.
- **Trip date**: worked out from the event time and the active-day check.
- **Gmail message ID**: used to skip duplicates. The `bus_geofence_log` table has a unique index on `gmail_message_id`, so reading the same message twice changes nothing.

#### Fuzzy checkpoint matching

FirstView's checkpoint names can vary: "Maple & 3rd" might arrive as "Maple and 3rd", "Maple/3rd" or "Maple 3rd" in different emails. Prism matches loosely against your checkpoint list, so small differences still match.

#### Historical median transit times

After a few weeks of data, Prism works out the median time between each pair of checkpoints over the last 30 days. That is what gives you a prediction such as "8 min" before the distance email arrives.

If the median from `Pine Grove → Our stop` is 4 minutes and the bus has just passed Pine Grove at 7:38, the widget shows "Bus 4 minutes away", predicting arrival at 7:42. It updates at once when the real arrival email comes in.

### Privacy

Your bus tracking data stays on your instance. Gmail is the only outside service involved, and Prism's read-only access lets it read the FirstView emails you already get.

- Gmail OAuth tokens are stored encrypted with AES-256-GCM.
- Prism doesn't keep the email text. It stores only the fields it reads out (checkpoint, event time, event type) and the Gmail message ID for skipping duplicates.
- You can disconnect at any time in *Settings → Bus Tracking → Gmail Connection → Disconnect*. Prism deletes the tokens, and the bus data you already have stays in your database but stops updating.

### Troubleshooting

#### "Bus tracker shows nothing"

The most common cause is that no FirstView email has arrived yet today. The widget starts when the day's first email arrives, so check Gmail for today's emails.

If Gmail has them and Prism doesn't, check:

1. *Settings → Bus Tracking → Gmail Connection*, to see that it is still connected.
2. *Settings → Bus Tracking → Gmail label*, to see that the label filter is right. If your filter sends the emails to a `bus` label, the default search of all mail might not find them, but a search of that label would.
3. Then force a sync with *Settings → Bus Tracking → Sync now.*

#### Route auto-discovery missed a trip

Discovery looks at the latest 100 or so FirstView emails. If your district has just added a trip, or you recently forwarded older emails into Gmail, discovery might miss it. Add the route yourself in *Settings → Bus Tracking → Add Route* with the trip ID and direction.

#### Checkpoint progress dots don't fill in

Your checkpoint names have to match (loosely) the ones FirstView sends. If a checkpoint never fills, look at the `bus_geofence_log` rows to see which `checkpoint_name` Prism read, and change your `checkpoints` setting to match.

#### "Overdue" status on weekends

Routes are active Mon to Fri (`[1,2,3,4,5]`) by default, so weekends should already show as off duty. You can't edit active days in the route dialog today. If a route runs on a different schedule, that is a current limit of Prism, and there is no setting for it yet.

#### ETA shows "925m" or other huge value

Older versions had a bug that left large minute counts unconverted to hours and minutes. v1.3 fixed it, so you should now see "15h 25m". Do a hard reload if you still see raw minutes.

#### Gmail rate-limited

Gmail's API allows a lot of requests, but there is a limit. Pausing hidden tabs and checking more slowly when the bus is far away keep one family on one Gmail account well inside it. If you do hit the limit (several dashboards checking the same account from different tabs, for example), Gmail answers with a 429 error and Prism backs off. Sync starts again after a pause.

#### "Bus at school" shows 0-minute ETA at pickup time

An old display bug made afternoon routes show "0 min" before the bus left school, when they should have said it was at school and on the way. It is fixed, and the row now reads "Bus at school, en route."

#### Arrival timestamps were off by 6 hours

Early v1.3 had a time zone bug: the parser read the time in the email body as UTC, when it should have used the email's `Date:` header, which carries the time zone. It is fixed. Old data with the wrong time stays as it is while new arrivals are correct, and you can re-read old rows by deleting them and syncing again.
