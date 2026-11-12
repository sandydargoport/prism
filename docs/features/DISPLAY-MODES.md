# Idle, away and sitter screens

What the wall shows when nobody is using it, when you are away, and when a sitter is in charge.

- **Screensaver**: your photos, with the time and a few widgets on top, when nobody is using the screen.
- **Away mode**: only photos and the clock, for when the house is empty. A parent PIN turns it off.
- **Babysitter mode**: house information, contacts and notes about the children, for a sitter.

Each one covers the dashboard, which keeps running underneath.

## Use it

### Screensaver

The screensaver starts after the screen has been idle for a time you set. It shows a photo slideshow with the widgets you pick on top, such as the clock, weather and calendar.

#### Each dashboard has its own screensaver

Every dashboard has its own screensaver layout. The kitchen dashboard (`/d/kitchen`) can have a big clock, the weather and a slow photo cycle, while the bedroom dashboard (`/d/bedroom`) has a smaller clock and tomorrow's calendar.

A screen is in one of three states through the day: **Active** while someone is using it, **Resting** once nobody has touched it for a while, and **Night** when it rests after dark. The editor's **Through the day** sheet shows them in a strip. Tap one and the screen shows that state at once.

Under the strip the day is a line: a stretch for resting, a darker stretch for night, a dot where night starts and where it ends, and a block for each Interlude. Tap a dot, a stretch or a block and the screen shows that time, with a card under the line holding only that part's settings. The night dots set when night is and what it looks like, a resting stretch sets what shows while resting and how soon, and an Interlude's block sets its dashboard, days and times. **Today** at the top of the line picks another weekday. The slider under the line plays the day, so you can see 9:30 pm in the afternoon. **Done** saves the dashboard's choices and **Cancel** undoes them.

#### A calm dashboard is its own idle screen

A dashboard set to rest as **This dashboard** (in the Through the day sheet) has no separate screensaver. When the display goes idle, some widgets fade out where they are and the others stay. A tap brings everything back, and nothing moves.

Tap **Resting** in the Through the day sheet and each widget on a calm dashboard gets a **Stays** or **Fades** button in its top-right corner. Tap it to choose, then **Done**. Until you set a widget, the clock, weather and calendar stay and everything else fades.

#### Resting, night and what shows

The Through the day sheet sets what shows while the screen rests (**This dashboard**, **Photos** or **Night sky**, in a resting stretch's card) and what night looks like (**Dim this dashboard**, **Night sky** or **Screen off**, in a night dot's card, with Photos behind **More**). It is saved with the dashboard, so every screen showing that dashboard looks the same. If one screen should idle differently, give it its own dashboard (*Settings → Screens*, **Edit**, then the **Dashboard** sheet).

- **Photos**: the slideshow.
- **Night sky**: the stars, Milky Way, constellation figures and moon as they are outside right now, worked out from the household location in *Settings → General* and drawn over a treeline on the horizon. As at a real dusk, the Milky Way is the last thing to appear, and it fades when the moon is bright. Once it is dark, one constellation at a time is drawn in, line by line outward from its brightest star (the way you would find it outside). Then it is named, with what the name means and the names of its brightest stars, for about twenty seconds. The next one follows after a pause. Each display remembers which constellations it has shown and picks the one shown longest ago, best known first, skipping any that a widget would cover, so over the nights of a season it gets through all of them. The brightest stars twinkle, and a shooting star crosses every few minutes. On the nights around the peak of one of the ten major yearly meteor showers (the Quadrantids, Lyrids, Eta Aquariids, Southern Delta Aquariids, Perseids, Draconids, Orionids, Leonids, Geminids and Ursids), while its radiant (the point the meteors seem to come from) is above the horizon, a line at the top says so, for example "Geminids peak tonight, up to 150 an hour", and mentions whether a bright moon will hide the fainter ones. A small ring marks the radiant when it is in view, and shooting stars come more often and streak away from it. During a lunar eclipse visible from home, the moon turns copper as it moves into the Earth's shadow. If **Say when aurora may be visible** is ticked in *Settings → Appearance → Screensaver* (off by default, one switch for every display), a second line says when NOAA's aurora forecast gives a chance of aurora overhead or low on the horizon toward the pole ("Aurora possible now, low in the northern sky"). When the device is set to reduced motion, or the performance level is Reduced or Minimal, the twinkling and shooting stars stop and each constellation appears whole instead of being traced. In the daytime it shows a plain sky. It loads no images and redraws once a minute, so it costs next to nothing on a display that never sleeps, and visitors see no family photos.
- **Night**: from dusk to dawn, half an hour after sunset until half an hour before sunrise where the household is, or at set times on the display's clock, such as 21:00 to 06:30. The sheet shows tonight's real times. Behind **More** you can move each edge earlier or later by some minutes or hours. Near midsummer, far from the equator, dusk and dawn are only a few hours apart and large offsets can make the night end before it starts. The editor warns you and won't save a setting like that. While resting, the display checks every minute whether night has begun. The same night also turns Today's ink warm and brings up its veil, and it is when the screen dims.
- **Screen off**: a black screen until someone touches it, for a bedroom or a hallway.

All of this is worked out on the display from the date and location, and nothing is downloaded, apart from the aurora forecast when that is switched on. The server fetches the forecast from NOAA's Space Weather Prediction Center at most every 30 minutes, and only while a display is showing the night sky after dark. If NOAA doesn't answer, the line is left off. The forecast is read for the household location, so it needs a location set in *Settings → General*. Without a location, Prism uses the time zone to estimate it, and the change at sunset is then right to within about an hour.

#### Widget transitions

By default the screensaver shows every widget in its layout all the time. It can instead show some of them and rotate which ones are up, so the board changes slowly. That is easier on the panel, because nothing sits in one place for hours, and it gives the screensaver something to do besides change photos.

*Widget transition effect* offers four ways for a widget to come and go:

- **Fade**: the widget fades in and out, easing at both ends. Arriving and leaving are not mirror images on purpose: a widget appears at once and settles, and it pauses a moment before it goes.
- **Smoke**: the widget itself dissolves. A turbulence mask thins out its own pixels in soft-edged patches, and nothing is drawn on top of it.
- **Fill and drain**: a waterline crosses the widget, with a surface that keeps moving and bubbles rising through it. One widget drains while another fills, and the two match exactly, so the water leaving one is the water arriving in the other. Only one pair moves at a time, and the two widgets are picked from opposite sides of the board so it looks like water passing between them and not one column doing something odd.
- **Fireworks**: the widget breaks apart into its own pixels. Prism samples it pixel by pixel and turns each sample into a fragment with that pixel's colour, so at the moment of the burst the fragments are the widget. It winds up first: the card puts down its background, the widget swells and pulls back in, and then it bursts. The fragments speed up as they scatter and cool to embers.

Fireworks is the only effect with a real cost. It switches to a plain fade automatically on hardware that reports itself as low-end, and whenever the display asks for reduced motion.

#### Drift

Separately from the transitions, the widgets that are showing move very slowly in a figure eight, 4 px each way over a minute and a half. This is for the panel. Rotating which widgets are shown helps against burn-in, and moving the ones that are up helps more, because it shifts their edges as well as what is inside them. Drift also runs on a dashboard that fades to a calm view of itself.

All widgets move together, so the gaps between them stay as you designed them. The movement is in whole pixels, since moving by part of a pixel leaves the same physical pixels lit and does nothing. Four pixels is enough to move thin outlines and text clear of where they were. It can't move a thick stroke such as the clock's digits fully off its pixels, and any more movement would start to be noticeable.

#### Dim at night

At night the resting screen gets darker: a black layer eases in over a few seconds on top of the screensaver or the calm dashboard, and a touch lifts it. Night is the dashboard's own, set in the Through the day sheet, and **How dark** there sets the darkness for this screen. Each screen sets its own. Dimming is off until you choose **Dim this dashboard** or a darkness.

A web page can't change the panel's own brightness or turn it off. On an OLED panel the black layer really does dim it. On an LCD the backlight stays on, though less light reaches the room. A screen that should go fully dark at night still needs the computer's own display sleep.

#### Configuration

Screensaver settings are under *Settings → Appearance → Screensaver*, and you can also open them from the screensaver itself (see below).

- **Start after**: how long the screen is idle before the screensaver starts. 30 seconds, 1 minute, 2 minutes, 10 minutes, 1 hour or Never (default 2 minutes).
- **Change photo every**: how often the photo changes, from 5 seconds up to 1 hour, or Never for one still image.
- **Widget transition effect** and **Change every**: which effect to use, and the shortest gap between changes. It is a minimum because a new rotation never starts before the last one has finished, so a long effect sets its own pace.
- **Transition length**: Brisk, Normal, Slow or Very slow. It scales every effect at once.
- **Show at least / at most**: the fewest and most widgets on screen at once. By default about two thirds of the layout shows, within those limits.
- **Hide widget outlines**: removes the border around each widget. Lines inside a widget are left alone.
- **Carbonation**, **Surface wobble**, **Keep text clear of the waterline**: for fill and drain only. The last one decides whether the water surface passes over the top line of a widget's text or over the empty space above it. Some people like seeing the water cover the content and others see it as a fault, so it is left as a switch.
- **Drift**: on or off, on by default.
- **Dim at night**: Off, or 25%, 50% or 75% darker at night. Off by default.
- **Show a settings shortcut on the screensaver**: off by default.
- **Sign out after**: how long the display can sit untouched before it stops being signed in as whoever used it last. The choices run from 5 minutes up to 4 hours, or Never, and the default is 30 minutes. Like the other timers here, it is set per device.

  Signing out leaves the screen showing everything. `getDisplayAuth` keeps serving the dashboard as the configured display user, so anyone who walks up can still read the calendar, tasks and messages. What returns is the PIN prompt on anything that changes something.

  The reason for this setting: a parent session lasts 7 days, its window is renewed on every request, and the dashboard polls all the time. Without this timer, one sign-in would leave the display signed in as that person until the 30-day hard limit, and whoever walked up next would get their access.

  It is kept separate from the screensaver on purpose. The screensaver timer only changes the look and is often set to two minutes, and people who get asked for a PIN that often soon resent it.

#### Changing it from the screensaver

To judge a transition you have to watch it. Without a shortcut, each change meant leaving the screensaver, finding the settings page, changing one value and waiting for the screensaver to come back.

With the shortcut turned on, a Prism mark sits in the top-left corner of the screensaver. It is invisible until you hover over it, then fades in over two seconds, and it opens the same settings in place. On a touchscreen you can tap that corner even when nothing is drawn there.

All of these settings are per display and stored on the screen where you set them, so two screens in one house can run different effects.

The screensaver *layout*, meaning which widgets show and where, is edited in dashboard edit mode. The editor links to these settings, because arranging a screensaver and choosing how it moves are two parts of the same job.

You choose which photos appear under *Settings → Photos:*

- **Source filter**: which photo sources to use.
- **Orientation filter**: landscape, portrait or square, set separately for each display context (gallery, wallpaper, screensaver).
- **Pinned photo**: show one fixed photo in place of the slideshow, for places you want to stay the same.

#### Activation behavior

- Any mouse, touch or keyboard activity restarts the idle timer.
- Whether the tab is visible makes no difference, and an idle tab that is on screen still starts the screensaver. That is the kiosk case: nobody is using the wall display, so it shows the slideshow.
- The screensaver doesn't start when:
  - The Edit dashboard mode is on.
  - A modal is open.
  - The PWA detects mobile mode. It is switched off there automatically, since phones don't need a screensaver.

#### Exiting

- Tap anywhere, press a key or move the mouse, and the screensaver fades back to the dashboard.
- No PIN is needed, so anyone can dismiss it.

### Away Mode

Away mode is a privacy cover for when nobody is home, or when you don't want someone passing by to see what's on the dashboard. It shows only a photo slideshow and a small header bar with the clock and weather.

#### Why this exists

Say your dashboard hangs in a kitchen you can see from the front door. A delivery driver, a neighbour or a visiting house sitter glances through the window and sees the family calendar, today's chores and which tasks are due. That is more than a stranger should see.

Away mode cuts the screen down to the clock, the weather and a photo.

#### Activation

There are two ways to turn it on:

1. **Manual**: tap the **palm-tree icon** in the dashboard header. Prism asks "really activate Away mode?", and when you say yes the mode starts.
2. **Auto**: set it in *Settings → Appearance → Timers & Auto-Activation → Away Mode Auto-Activation:*
   - **Never (manual only)**: never turn on by itself.
   - **4 hours** without any use, then it turns on.
   - **8 hours** without any use, then it turns on.
   - **12 hours** without any use, then it turns on.
   - **1 day** without any use, then it turns on.
   - **2 days** without any use, then it turns on.
   - **3 days** without any use, then it turns on.
   - **1 week** without any use, then it turns on.

Any touch, click or key press restarts the auto timer.

#### The Away Mode display

- A header bar across the top:
  - The clock on the left.
  - The weather on the right, with the current temperature and conditions.
  - Both are compact and fit on one line.
- Below that, a full-screen photo slideshow.
  - It uses the photo source you set for the screensaver, with the same filter.
  - It changes photos at the same interval.

There is no calendar, chores, tasks, messages or widgets, only the time, the weather and the slideshow.

#### Exiting

Tap anywhere and a PIN keypad appears. Enter a **parent PIN** to leave Away mode. Children can't turn it off, on purpose, because the point is to keep the family's information private while no adult is around to allow it.

If you forget the PIN, reset it offline with the recovery script that ships inside the app container. Run `docker compose exec app node scripts/reset-pin.js --list` to see member names, then `docker compose exec app node scripts/reset-pin.js "Name" 1234` to give that member a new PIN. The script hashes the PIN the same way the app does and changes only that member's row.

#### Use cases

- **Kitchen with view of the street**: turn on automatically after 8 hours so the dashboard goes private overnight.
- **Vacation home**: turn it on by hand as you leave so the cleaner or property manager doesn't see your whole schedule.
- **Extended trips**: turn on automatically after 1 week so even house sitters don't see when the family is coming back.
- **Always-on screens used part-time**: turn on automatically after 4 hours so the screen doesn't sit on the dashboard through working hours when nobody is looking.

### Babysitter Mode

Babysitter mode is a cover screen with the household details a caregiver needs. You turn it on by hand, or share a public URL, when a babysitter, family friend or other short-term caregiver is at the house.

#### What's on it

You fill it in under *Settings → Babysitter Info.* The sections are:

- **Emergency contacts**: phone numbers for parents, grandparents, the doctor, the school, poison control and emergency services. Tap a number to call it, if the device can make calls.
- **House info**: the WiFi name and password (with a QR code to join in one tap), door codes, security system codes, the garage code, the address and the nearest cross street.
- **Per-child info**: allergies, medications and when to give them, bedtime, dietary restrictions and any special notes ("Sophie won't sleep without her bunny").
- **House rules**: anything you want the caregiver to know, such as screen time, snacks or what to do in a given situation.
- **Pet info** (if you set it up): feeding times, where the pet food is kept and the vet's contact details.

#### Sensitive sections

You can mark any section as **sensitive** in *Settings → Babysitter Info.* A sensitive section still appears on the screen, but a parent PIN is needed to reveal it. Some places this helps:

- Door codes you don't want on show if someone outside the family walks through.
- The WiFi password, if lots of people get to see the babysitter screen.
- A child's medical details, if you only want the caregiver to see them when they need them.

A sensitive section shows a placeholder ("Tap to reveal: parent PIN required") until someone unlocks it, and then it stays visible for that session.

#### Activation

There are two ways to turn it on:

1. **Tap the babysitter icon** in the dashboard header.
2. **Share the public URL** `/babysitter`, which works without logging in. You can send it to a sitter ahead of time so they have the information on their phone as well.

#### The /babysitter public URL

Anyone with the URL can open the babysitter view. You might:

- Send the sitter the URL the day before so it's on their phone.
- Put it on the fridge as a QR code.
- Give it to a one-off caregiver who won't use the wall display.

The sensitive sections still need a PIN to unlock when someone views them through the public URL.

#### Leaving a note for the family

While Babysitter Mode is on, the Babysitter Mode screen has a **Leave a note for the family** box. The screen covers every page while the mode is on, so a sitter who opens `/babysitter` on their phone gets the box too. The sitter types a note of up to 500 characters, adds their name if they like, and taps **Send**. The note appears on the [Messages](MESSAGES.md) board marked as from the babysitter, for example "Everyone ate dinner. One of the kids bumped an elbow, Band-Aid on."

- Prism only accepts notes while a parent has Babysitter Mode on. When it is turned off, the screen and the box go away and the server refuses new notes.
- Posting needs no login or PIN, so anyone who can open `/babysitter` during that time can post. Prism accepts up to 10 notes an hour for the whole household.
- The sitter can't read the Messages board, and only a parent can edit or delete a sitter's note.
- With the authentication wall on, the note box only works on a trusted device, like the rest of `/babysitter`.

#### Today's meals

While Babysitter Mode is on, the Babysitter Mode screen shows a **Today's Meals** card with what the meal planner has for today. It lists each meal's name and whether it is breakfast, lunch, snack or dinner, in that order, and it is read-only. The screen covers every page while the mode is on, so a sitter on `/babysitter` sees it too.

- It shows today only, by the household's time zone. Other days stay on the family's meal planner.
- It shows only the name and the meal slot, and leaves out recipes, ingredients, descriptions and who cooked.
- When nothing is planned today, there is no card. When the mode is turned off, the server stops sending the card's data.
- Changes to the plan appear within about five minutes.

#### Exiting

Tap anywhere, enter a parent PIN on the keypad, and you are back on the dashboard.

The public URL `/babysitter` has no exit as such, since it is just a web page. Close the tab.

#### Use cases

- **First-time sitter**: when they arrive, tap babysitter mode, go through the screen with them, and leave. The wall display now has everything they need, and they never need your phone.
- **Grandparents visiting**: the same idea, even though they are family. House codes, the WiFi password and your phone numbers are all on show.
- **Pet sitter**: add pet sections alongside the babysitter ones.
- **Long-term caregivers**: mark sections sensitive so the everyday screen shows the basics, and keep medications, bedrooms and specific medical notes behind the PIN.

## Details

### Layered behavior

These modes sit in layers. The dashboard is always running underneath, and whichever mode is on covers it.

- The screensaver shows the photo slideshow and widgets.
- Away mode shows the photo slideshow, clock and weather, with no widgets.
- Babysitter mode shows the babysitter information full screen, with no slideshow.

You switch modes with the header icons. Away mode and babysitter mode need a PIN to leave before you can switch.

### Performance considerations

The screensaver, away mode and babysitter mode each load only when they are turned on, and not every time the dashboard draws. In v1.0.4 the chain of imports that had pulled them into the root layout was cut, to keep the dashboard's first paint fast.

At the Reduced and Minimal performance levels (*Settings → Appearance → Performance*):

- The screensaver's Fireworks effect becomes a plain fade, and the night sky stops twinkling.
- At Minimal, the fades between idle and awake are almost instant.
- Away mode and babysitter mode run as usual.

### Privacy summary

| Mode | Shows | Reachable without login? |
|---|---|---|
| Dashboard | Everything (calendars, tasks, etc.) | Yes, but read-only |
| Screensaver | Photos + configured widgets | Same as dashboard |
| Away Mode | Photos + clock + weather only | After timeout / manual activation |
| Babysitter Mode | House info + contacts + child notes + today's meals, sitter can leave a note | Yes, via `/babysitter` URL |

If you're worried about what someone passing by can see, use Away mode and set it to turn on after a time that fits how you use the screen.

If you need to give a babysitter or short-term guest the information they need, use Babysitter mode.

### Troubleshooting

#### Screensaver doesn't activate

- Check *Settings → Appearance → Timers & Auto-Activation → Screensaver Timeout* to see if it is set to "Never".
- Check whether the dashboard is in edit mode, which stops the screensaver.
- Check whether a modal is open, which also stops it.
- In an installed app, the screensaver starts by itself only on a screen named in *Settings → Screens*. On a phone it stays off, on purpose. Name the wall screen if it runs as an installed app.

#### Away mode won't exit

You need the parent PIN. If you've forgotten it, reset it offline with the script inside the app container. Run `docker compose exec app node scripts/reset-pin.js --list` to see member names, then `docker compose exec app node scripts/reset-pin.js "Name" 1234` to give that member a new PIN.

#### Babysitter info shows blank

Nothing has been filled in under *Settings → Babysitter Info.* Add at least one section so the page has something to show.

#### Sensitive section won't unlock with the right PIN

Check that the PIN belongs to someone with the **parent** role. A child's PIN can't unlock sensitive sections.

#### Public /babysitter URL not loading

Make sure at least one section is filled in under *Settings → Babysitter Info*, because an empty babysitter view has nothing to show. Also check that the device can reach the Prism host on your network.

#### Photo slideshow stutters during screensaver

The screen may be running at the Minimal performance level, where the Photo widget shows a single image. Look in *Settings → Appearance → Performance*. With Auto selected, it shows which level is in use.

#### Wrong photo source on the screensaver

The screensaver's photo filters (sources, orientation per context, pinned photo) are in *Settings → Photos* under the **screensaver** display context. Change them there.

#### Babysitter QR code for WiFi doesn't work

The QR code uses the standard `WIFI:` URI format. Some older Android devices can't join Wi-Fi from a QR code, and on those the sitter has to type the password. Before blaming the QR code, check that the password works when typed in.

#### Clock in away mode showing wrong time

This comes from the browser's time zone. The away-mode clock uses the browser's local time zone, so check the system time zone on the device running the dashboard.
