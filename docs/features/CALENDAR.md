# Calendar

![Calendar month view](../demos/calendar-month.png){ .hero-image }

The calendar brings every family member's schedule together with meals, chores, and tasks in one place. It supports Google Calendar OAuth (read+write), iCal subscriptions (read-only), ten view modes, drag-and-drop, click-to-edit from the dashboard widget, and a server-side sync cron that keeps events current even when nobody's looking at the dashboard.

---

## Setting up calendar sources

### Google Calendar (OAuth — bidirectional)

*Settings → Connected Accounts → Google → Connect.*

OAuth grants Prism read+write access to your Google Calendars. You can create, edit, drag, and delete events in Prism, and changes push back to Google Calendar within seconds. Each individual calendar in your Google account (personal, family-shared, work, etc.) shows up in *Settings → Calendars* where you decide which to display.

The connection covers Calendar specifically — if you also want Google Tasks sync, that's a separate per-feature OAuth in *Settings → Task Sync*.

### iCal subscriptions (read-only)

*Settings → Calendars → Subscribe to a calendar → paste URL.*

For any calendar published as an `.ics` URL — school calendars, sports leagues, holiday feeds, your spouse's outlook.live.com calendar — paste the URL and Prism subscribes. Events sync periodically and appear alongside Google events. iCal sources are read-only by definition (no write endpoint exists for these feeds), so the dashboard treats them like any other source for display but won't offer edit affordances on their events.

### Apple Calendar / iCloud (read-only via the iCal feed)

iCloud doesn't speak OAuth or expose a public REST API, so Prism rides the same iCal-subscription path. Apple makes a `webcal://` URL available for any calendar you mark as Public. From a Mac:

1. Open *Calendar.app*, right-click the calendar in the sidebar → *Share Calendar*.
2. Tick **Public Calendar** — a URL appears underneath.
3. Click the *share* button next to the URL and *Copy Link* (it'll start with `webcal://`).
4. In Prism: *Settings → Calendars → Subscribe to a calendar*, paste the URL, give it a name, click *Add*.

From iCloud.com it's the same idea: *Calendar → ⓘ next to the calendar → Public Calendar → Copy Link*.

Caveats: this is a one-way feed (changes you make in Prism don't push back to iCloud — there's no UI to "edit" these events because the feed is read-only), and the calendar has to be marked Public on iCloud's side.

### Apple iCloud (CalDAV — private calendars + Reminders) — *alpha*

For calendars you don't want to mark Public — or to sync **Reminders** as tasks — Prism supports iCloud over CalDAV. This is the same protocol the macOS/iOS Calendar app uses.

1. Generate an app-specific password at [appleid.apple.com](https://appleid.apple.com) → *Sign-In and Security → App-Specific Passwords → Generate*.
2. In Prism: *Settings → Connected Accounts → CalDAV → Connect CalDAV server*.
3. Enter:
   - **Server URL:** `https://caldav.icloud.com`
   - **Username:** your iCloud email
   - **Password:** the app-specific password from step 1 (not your Apple ID password)
4. Click *Test Connection*, then *Find Calendars*, pick which calendars and Reminders lists to sync, and *Connect*.

The same flow works for **Nextcloud** (`https://your-server/remote.php/dav`), **Radicale**, **Baikal** (`https://your-server/dav.php`), and **Synology Calendar** (`https://your-nas:5001/caldav/`).

Caveats: this path is currently **read-only** — events and tasks pulled from CalDAV appear in the dashboard but can't be edited from Prism (two-way write is on the roadmap). App-specific passwords are stored encrypted in the Prism database and never leave your server. Apple Reminders sync into Prism's Tasks list with the same priorities and due dates the iOS app uses.

### Per-calendar customization

In *Settings → Calendars*, each source supports:

- **Enable/disable** — toggle off without disconnecting. Disabled calendars don't appear anywhere in the UI.
- **Assign to a family member** — links the calendar to a person so its events appear in that person's column on Day/List views. Mark a calendar as **Family** if it's a shared household calendar.
- **Display name** — override the Google/iCal name (e.g. "Mike's Work" → "Work").
- **Color** — override the source's default color.
- **Show in Add Event modal** — uncheck for subscription / read-only calendars so they don't appear as creation targets.

---

## Server-side sync

A 10-minute background cron job keeps Google + iCal events in sync without depending on anyone having the dashboard open. The default sync window is **−90 days to +365 days** — past three months stay populated for historic views, and the next school year fits comfortably ahead.

Events outside the window are not deleted — once an event is synced into Prism's database, it remains there permanently. The delete-on-remove pass only operates inside the window, so manually shrinking the window won't lose your archive.

Set `PRISM_DISABLE_CALENDAR_CRON=true` in your `.env` to fall back to user-triggered syncs only (e.g. on a low-power device where you don't want background work). Manual sync is always available from *Settings → Calendars → Sync*.

---

## Views

Both the calendar subpage and the dashboard widget expose the same set of ten views:

| View | Best for |
|---|---|
| **Agenda** | Upcoming-events list. Default view on mobile. |
| **Day** | Hourly breakdown with side-by-side calendar columns. |
| **List** | Vertical week view — each day stacks its events. Pairs well with the notes column. |
| **Schedule** | Week shown as one tall vertical column. Good for narrow displays. |
| **1W** | Single week, 7-day grid with hourly rows. |
| **2W / 3W / 4W** | Multi-week grids — 2 / 3 / 4 weeks visible at once. |
| **Month** | Standard calendar grid (6-week rendered span). |
| **3 Months** | Three months side-by-side. Long-term planning. |

The view dropdown has ▲▼ triangles for one-click cycling. Multi-week navigation advances/retreats by `weekCount` (so 4W view's "next" jumps 4 weeks ahead, not 1).

On phones, calendar views collapse to Agenda only — no view switcher, no chevrons. Header reads "Upcoming Events."

---

## Display modes: inline vs cards

The **View Options** gear (next to the view dropdown) lets you switch between two ways of laying out events within each day cell:

- **Inline** — compact rows of event titles. Original look. Highest event density per cell.
- **Cards** — each day becomes a small card with meals at top, events in the middle, chores+tasks at bottom. A dynamic capacity probe respects your font scale and viewport. Overflow folds into a "+N more" popover so nothing is silently clipped.

Cards mode is what unlocks drag-and-drop and overlays.

The toggle persists per surface — the calendar subpage and the dashboard CalendarWidget remember independently which display mode you prefer.

---

## Drag-and-drop

When you're in **cards mode**, you can drag any of these between days:

- Events
- Meals
- Chores
- Tasks

Works on Day, List, Week, 1W-4W, Month, 3 Months, and Agenda. Works on the dashboard CalendarWidget too. The drag activates after 5px of pointer movement, so single taps still trigger click-to-edit on the same card.

If the API rejects the move (e.g. moving a recurring event instance is restricted), the error surfaces inline as a `moveError` chip on the source cell — no silent failures.

### What gets preserved when you drag

- **Tasks** — the task's time-of-day stays (a 9am task on Tuesday dragged to Thursday is still 9am, not 23:59).
- **Events** — start/end times are preserved; only the date shifts.
- **Meals + chores** — these don't have specific times by default, so they just move to the new day.

---

## Click-to-edit from the widget

Tasks, chores, and meals shown on the dashboard CalendarWidget are clickable. Tapping any of them opens the same edit modal the calendar subpage uses. The modals lazy-load so the dashboard's first paint isn't taxed.

This means you can do most calendar interactions without leaving the dashboard — edit a chore, drag a meal, click an event for details, all without navigating to `/calendar`.

---

## View Options menu

The gear next to the view dropdown opens View Options. Available toggles depend on the active view:

- **Hide weekends** — multi-week views only (the only views that meaningfully respect weekends).
- **Merge calendars** — combine all events into one column on Day/List views instead of splitting by person.
- **Show notes column** — Day and Schedule views only. Renders the calendar-notes panel beside the events.
- **Overlay toggles** — show/hide events, meals, chores, and tasks independently. The badge on the View Options trigger flags when any toggle is non-default.
- **Display mode** — Inline / Cards (also reachable here, in addition to the per-view default).
- **Reset to defaults** — restores everything.

Settings persist to localStorage, separately for the subpage and the dashboard widget.

---

## Calendar Groups & Columns

In Day and List views, events organize into columns by calendar group:

- The **Family** group always appears first (for shared/family-tagged calendars).
- **Person columns** appear after Family, in the order set by *Settings → Family Members*.
- Reorder family members to change the column order.
- Use the **Merge / Split** toggle (in View Options) to combine all events into a single column or separate by person.

Filter buttons at the top of the calendar let you show/hide specific calendar groups for the current view. Click **All** to show everything.

---

## Calendar Notes

Click the **sticky note icon** in the calendar header to open a notes panel beside Day or List views. Notes are:

- **Day-tied** — anchored to a specific calendar date.
- **Family-shared** — anyone in the family sees the same content; no per-user notes.
- **Auto-saving** — saves after 2 seconds of idle typing and on focus loss.
- **Formatted** — supports light Markdown via keyboard shortcuts.

Formatting shortcuts (while focused in a note):

- **Ctrl+B** Bold
- **Ctrl+I** Italic
- **Ctrl+U** Underline
- **Ctrl+Shift+S** Strikethrough
- **Ctrl+Shift+L** Bullet list (type `- ` at the start of a line for the same effect)

Notes are read-only when not logged in (so the screensaver / babysitter view can show them without exposing edits).

---

## Hidden Hours

Hide a time range from Day/Schedule/Week views so most of the visible space goes to hours your family actually uses. Configure the range in *Settings → Display → Calendar Hours*:

- Set start hour (e.g. midnight)
- Set end hour (e.g. 6 AM)

Toggle visibility with the **clock button** in calendar views — it dims when active. The remaining visible hours auto-resize to fill the panel; you don't get tiny event blocks scrunched into a tall column.

---

## Color coding

Events inherit their color from the calendar source they belong to. When calendars are assigned to family members, each person's events show in their column with the calendar's color. Override per-calendar in *Settings → Calendars*.

Cross-calendar events (e.g. the same event in your Google personal calendar and the Family Google calendar) are deduplicated by `groupId` at render time, so you don't see ghost duplicates across columns.

---

## Adding events

Click **Add Event** in the calendar header (or on the CalendarWidget). The modal includes:

- **Title** (required)
- **Calendar** — picker filtered to calendars marked "Show in Add Event modal".
- **Color** — preset palette + your profile color.
- **Description**
- **Location**
- **Start / End time** or **All day** toggle.
- **Recurrence** — None, Daily, Weekly, Monthly, Yearly (writes to Google Calendar's RRULE format if syncing to Google).

Subscription / read-only calendars are auto-hidden from the picker.

---

## Mobile behavior

- Calendar shows the **Agenda view only** on phone viewports — list of upcoming events, swipe to dismiss.
- View switcher hidden.
- Header simplified to "Upcoming Events."
- Swipe left/right to navigate periods.

This is intentional: full grid views don't fit comfortably on a phone, and the agenda is what people actually want when checking on the go.

---

## Troubleshooting

### Events not showing

1. *Settings → Calendars* — is the calendar enabled?
2. Tap **Sync** to force a refresh.
3. Check *Settings → Connected Accounts* — is Google still connected? (OAuth tokens can expire if revoked from the Google side.)
4. The server-side sync cron also runs every 10 minutes — wait one cycle.

### Events appearing in the wrong person's column

Check the calendar's assignment in *Settings → Calendars*. Cross-calendar events (same event in personal + Family calendars) dedupe by `groupId` — if you're seeing duplicates, file an issue with the calendar names.

### Sync cron not running

`PRISM_DISABLE_CALENDAR_CRON` set to `true` in `.env`? That's the kill switch. Otherwise the cron runs in `instrumentation.ts` on app startup and tries every 10 minutes.

### Drag-and-drop not working

Drag-and-drop requires **cards display mode** — switch via the View Options gear. Also: hold a chore/meal/task for ~5px of movement before dragging; a quick click triggers the edit modal instead.

### "Failed to move" error chip

The API rejected the move. Most common cause: trying to drag a recurring event instance to a different day (Google Calendar's API restrictions). Move the source event itself or detach the instance first.

### Hidden hours showing the wrong range

Hours are configured in 24-hour format (e.g. `0` to `6` for midnight-to-6am). Check *Settings → Display → Calendar Hours* and re-save if needed.

### Forecast day-of-week labels are off

This was a TZ bug in older versions — events would show on the wrong day for users in negative-UTC zones when an event crossed midnight UTC. Fixed in v1.7. If you still see it, hard-reload the PWA to clear cached chunks.
