# Display Modes

Three "what's on the screen right now" modes beyond the default dashboard:

- **Screensaver**: idle photo slideshow with widget overlays.
- **Away Mode**: privacy screen showing only photos + clock, parent PIN to exit.
- **Babysitter Mode**: caregiver overlay with house info, contacts, child notes.

All three are layered on top of the dashboard. The dashboard is always running behind the scenes; these modes just cover it with a different presentation.

---

## Screensaver

Activates after a configurable idle period. Shows a rotating photo slideshow with a configurable set of overlay widgets: clock, weather, calendar, etc.

### Each dashboard has its own screensaver

Screensaver layouts are dashboard-scoped. Your kitchen dashboard (`/d/kitchen`) can have a screensaver showing big clock + weather + a slow photo cycle, while your bedroom dashboard (`/d/bedroom`) has a smaller clock + tomorrow's calendar.

Edit the screensaver layout in dashboard edit mode by clicking the **Screensaver** button to switch from editing the dashboard to editing the screensaver overlay.

### Configuration

Screensaver timing lives under *Settings → Appearance → Timers & Auto-Activation (Screensaver):*

- **Screensaver Timeout**: how long idle before activating. Options: 30 seconds / 1 minute / 2 minutes / 10 minutes / 1 hour / Never (default 2 minutes).
- **Photo Rotation Interval**: how fast photos cycle within the screensaver (5 seconds up to 1 hour, or Never for a static image).

Which photos appear is configured under *Settings → Photos:*

- **Source filter**: which photo source(s) to draw from.
- **Orientation filter**: landscape / portrait / square, applied per display context (gallery / wallpaper / screensaver).
- **Pinned photo**: override the slideshow with a single static photo (for the surfaces you want stable).

### Activation behavior

- Mouse / touch / keyboard activity resets the idle timer.
- Tab visibility doesn't matter. Even an idle but visible tab triggers the screensaver. (This is the kiosk use case: nobody's interacting with the wall display, so show the slideshow.)
- The screensaver is suppressed when:
  - The Edit dashboard mode is active.
  - A modal is open.
  - The PWA detects mobile mode (auto-disabled: phones don't need screensavers).

### Exiting

- Tap anywhere, press a key, or move the mouse. The screensaver fades back to the dashboard.
- No PIN required (anyone can dismiss).

---

## Away Mode

A privacy overlay for when nobody's home (or when you don't want a casual passerby to see the dashboard's content). Shows only a photo slideshow + a compact header bar with clock and weather.

### Why this exists

Imagine your dashboard is mounted in a kitchen visible from the front door. A delivery person, neighbor, or visiting house sitter glances through the window. The dashboard shows your family's calendar, today's chores, what tasks are due. Too much information for a stranger to see.

Away mode strips that down to: clock, weather, photo. Nothing else.

### Activation

Two ways:

1. **Manual**: tap the **palm-tree icon** in the dashboard header. Asks "really activate Away mode?" → yes → mode engages.
2. **Auto**: configurable in *Settings → Appearance → Timers & Auto-Activation → Away Mode Auto-Activation:*
   - **Never (manual only)**: never auto-activate.
   - **4 hours** of no interaction → activate.
   - **8 hours** of no interaction → activate.
   - **12 hours** of no interaction → activate.
   - **1 day** of no interaction → activate.
   - **2 days** of no interaction → activate.
   - **3 days** of no interaction → activate.
   - **1 week** of no interaction → activate.

The auto-activation timer resets on any user interaction (touch, click, keyboard).

### The Away Mode display

- Top header bar:
  - Clock (left).
  - Weather (right). Current temp + conditions.
  - Both compact, single-line.
- Below: full-screen photo slideshow.
  - Pulled from the photos source you've configured for screensaver (same filter).
  - Cycles at the same interval.

No calendar, no chores, no tasks, no messages, no widgets. Just the time, weather, and a slideshow.

### Exiting

Tap anywhere. A PIN keypad appears. Enter a **parent PIN** to exit. Children can't exit Away mode, by design, since the use case is keeping the family's info private during periods when adults aren't around to authorize seeing it.

If you forget the PIN: reset it offline with the bundled recovery script from inside the app container: `docker compose exec app node scripts/reset-pin.js --list` to see member names, then `docker compose exec app node scripts/reset-pin.js "Name" 1234` to set a new PIN for that member. It hashes the PIN exactly like the app and touches only that member's row.

### Use cases

- **Kitchen with view of the street**: auto-activate after 8 hours so the dashboard goes private overnight.
- **Vacation home**: manual-activate when leaving so the cleaner / property manager doesn't see your full schedule.
- **Extended trips**: auto-activate at 1 week so even house-sitters don't see returning family's schedule.
- **Always-on screens used part-time**: auto-activate at 4 hours so the screen doesn't sit on the dashboard view during work hours when nobody's checking.

---

## Babysitter Mode

A caregiver overlay with essential household details. Activates manually (or via a public URL) when a babysitter, family friend, or other temporary caregiver is at the house.

### What's on it

Configurable in *Settings → Babysitter Info.* Sections include:

- **Emergency contacts**: phone numbers for parents, grandparents, doctor, school, poison control, emergency services. Tap to call (if the device supports it).
- **House info**: WiFi name + password (with QR code for one-tap connection), door codes, security system codes, garage code, address, nearest cross street.
- **Per-child info**: allergies, medications + dosing schedule, bedtime, dietary restrictions, special notes ("Sophie won't sleep without her bunny").
- **House rules**: guidelines for the caregiver. Screen time policy, snack policy, what to do if [scenario], whatever you want them to know.
- **Pet info** (if you set it up): feeding schedule, where pet food lives, vet contact.

### Sensitive sections

Mark any section as **sensitive** in *Settings → Babysitter Info.* Sensitive sections appear in the overlay but require a tap-to-reveal with a parent PIN. Useful for:

- Door codes you don't want visible at a glance if non-family briefly passes through.
- WiFi password if you're casual about who sees the babysitter mode.
- Per-child medical info if you only want the caregiver to see it when they specifically need it.

Sensitive sections show a placeholder ("Tap to reveal: parent PIN required") until unlocked. Once unlocked, they stay visible for that session.

### Activation

Two ways:

1. **Tap the babysitter icon** in the dashboard header.
2. **Share the public URL** `/babysitter`: works without login. You can send this URL to a sitter ahead of time so they have the info on their phone too.

### The /babysitter public URL

Anyone with the URL can access the babysitter view. Use cases:

- Email the URL to the sitter the day before so they can have it on their phone.
- Pin it on the fridge as a QR code.
- Share with a one-time caregiver who isn't going to use the wall display.

The public URL respects the sensitive-section gating: sensitive sections still require PIN unlock when viewed via the public URL.

### Exiting

Tap anywhere → PIN keypad → enter parent PIN → returns to the dashboard.

(The public URL `/babysitter` doesn't have an exit per se. It's just a webpage. Close the tab.)

### Use cases

- **First-time sitter**: they arrive, you tap babysitter mode, walk through the screen with them, leave. The wall display now shows the info they need without needing your phone for any of it.
- **Grandparents visiting**: same idea, even if they're family. House codes, WiFi password, your phone numbers all visible.
- **Pet sitter**: extends the babysitter sections to include pet-specific info.
- **Long-term caregivers**: set sensitive sections so the day-to-day visible info is the basics; PIN-protect medications + bedrooms + specific medical notes.

---

## Layered behavior

These modes are layered, not exclusive. The dashboard always exists underneath; the active mode overlays on top.

- Screensaver overlay → photo slideshow + widgets.
- Away mode overlay → photo slideshow + clock + weather (no widgets).
- Babysitter mode overlay → babysitter info screen (full-screen, no slideshow).

Switching between modes is done via the header icons (when not in away/babysitter, those require PIN to exit first).

---

## Performance considerations

Each overlay is lazy-loaded: the screensaver, away mode, and babysitter mode components only load when activated, not on every dashboard render. The transitive import chain that pulled them into the root layout was broken in v1.0.4 specifically to keep the dashboard's first paint fast.

In Performance Mode:

- Screensaver still works, but photo rotation pauses (single static image instead of cycling).
- Away mode runs normally, minimal overhead.
- Babysitter mode runs normally, static content.

---

## Privacy summary

| Mode | Shows | Reachable without login? |
|---|---|---|
| Dashboard | Everything (calendars, tasks, etc.) | Yes, but read-only |
| Screensaver | Photos + configured widgets | Same as dashboard |
| Away Mode | Photos + clock + weather only | After timeout / manual activation |
| Babysitter Mode | House info + contacts + child notes | Yes, via `/babysitter` URL |

If you're worried about what a casual passerby can see: Away mode is the answer. Set the auto-activation to a duration that matches your usage patterns.

If you're worried about what a babysitter or short-term guest needs to know: Babysitter mode is the answer.

---

## Troubleshooting

### Screensaver doesn't activate

- Check *Settings → Appearance → Timers & Auto-Activation → Screensaver Timeout*. Is it set to "Never"?
- Is the dashboard in edit mode? Edit mode suppresses the screensaver.
- Is a modal open? Modals suppress the screensaver.
- On mobile PWA installs, the screensaver is intentionally auto-disabled. This is by design.

### Away mode won't exit

You need the parent PIN. If you've forgotten it, reset it offline with the bundled script from inside the app container: `docker compose exec app node scripts/reset-pin.js --list` to see member names, then `docker compose exec app node scripts/reset-pin.js "Name" 1234` to set a new PIN for that member.

### Babysitter info shows blank

You haven't configured anything in *Settings → Babysitter Info.* Add at least one section so the page has content.

### Sensitive section won't unlock with the right PIN

Check that the PIN belongs to a **parent** role. Child PINs can't unlock sensitive sections.

### Public /babysitter URL not loading

Make sure you've configured at least one section in *Settings → Babysitter Info*. An empty babysitter view has nothing to render. Also confirm the device can reach the Prism host on your network.

### Photo slideshow stutters during screensaver

Performance Mode might be active: slideshows pause in performance mode (single image instead of rotation). Disable Performance Mode if you want the cycle behavior on a low-spec device, but watch CPU.

### Wrong photo source on the screensaver

The screensaver photo filters (sources, per-context orientation, pinned photo) live in *Settings → Photos* under the **screensaver** display context. Adjust them there.

### Babysitter QR code for WiFi doesn't work

The QR uses the standard `WIFI:` URI format. Some older Android devices don't support QR Wi-Fi join; on those, the sitter has to type the password manually. Confirm the password works typed in directly before blaming the QR code.

### Clock in away mode showing wrong time

Browser TZ issue. Check the system TZ on the device running the dashboard. Prism uses the browser's local TZ for the away-mode clock.
