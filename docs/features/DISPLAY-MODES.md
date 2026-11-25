# Idle, away and sitter screens

What the wall shows when nobody is using it, when you are away, and when a sitter is in charge.

- **Idle**: once nobody has touched the screen for a while, it shows the dashboard, quieter, a photo frame or the night sky. At night it can show something else and go darker.
- **Away mode**: only photos and the clock, for when the house is empty. A parent PIN turns it off.
- **Babysitter mode**: house information, contacts and notes about the children, for a sitter.

Idle is the screen's own look. Away mode and babysitter mode cover the screen, and the dashboard keeps running underneath.

## Use it

### In use, idle and night

The screen owns time and the dashboard owns content. A screen decides which dashboard it shows when, how it idles by day and at night, and how much darker it goes at night. A dashboard is a page of widgets with no sense of time, so two screens showing the same dashboard can idle differently.

A screen is in one of three states: **In use** while someone is using it, **Idle** once nobody has touched it for a while, and idle at **Night** after dark. All of it is set on the editor's **Screen** tab (More > Edit layout > Screen). At the top, one sentence says what the screen does, for example "Hallway shows Main. On school days it shows Bus board around bus time and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker." Under it, a strip of today shades the screen's night, draws each of its times as a band in the colour of that row's swatch, and marks now with a line.

Over the canvas, two toggles are always there: **In use | Idle** and **Day | Night**. Together they pick which of the four states the canvas draws, and it draws each as the screen does: idle, the photo frame over its photo, the night sky, or the dashboard with the widgets that do not stay faded; at night, as much darker as the screen is set to go, over every look, or black for **Screen off**; Glance in use at night under its night veil. The line under the canvas names what is drawn and at what size, for example "Main, idle, at night: a photo frame, 50% darker. 1280 x 800." **Day | Night** starts at the time it is now, and choosing an idle or night look in the Screen panel sets both toggles to show it.

More > Edit layout > Screen > When idle is a few rows, all the screen's own: **Idle after**, then two columns, **By day** and **At night**, with what it shows (**It shows**) and how much darker at night (**Darker**). **Advanced** has when night is, with tonight's times and the offsets, and the photo frame's motion. Idle and night belong to the screen, not to the dashboard it shows, and **Done** saves them to the screen, so a switch to another dashboard does not change how the screen idles. Night changes how the screen idles; to show a different dashboard in the evening, add a time under More > Edit layout > Screen > Shows (see [Which dashboard a screen shows](DASHBOARD.md#which-dashboard-a-screen-shows-and-when-it-switches)). A screen that never idles has no night look: its night column is greyed and says so.

Which one wins: someone using the screen sees the dashboard for that time. Idle, it shows its idle look, and at night its night look. Away covers the screen but keeps the night's darkness and Screen off. Sitter covers the screen and is never turned off.

#### The dashboard, quieter, as the idle look

A screen set to idle as **The dashboard, quieter** (More > Edit layout > Screen > When idle > It shows) has no separate photo frame. When the screen goes idle, some widgets fade out where they are and the others stay. A tap brings everything back, and nothing moves.

Pick **Idle** over the editor's canvas and each widget on the quieter dashboard gets a **Stays** or **Fades** button in its top-right corner, and the ones that fade are drawn faint. Tap it to choose, then **Done**. The selected widget's **Stays when idle** switch, in More > Edit layout > Widgets, does the same. Until you set a widget, the clock, weather and calendar stay and everything else fades.

#### Idle, night and what shows

More > Edit layout > Screen > When idle sets what shows while the screen is idle by day (**The dashboard, quieter**, **A photo frame** or **The night sky**) and at night (**Same as by day**, one of the others, or **Screen off**), and how much **Darker** it goes at night. Both belong to the screen, so two screens showing the same dashboard can idle differently, and a switch changes what a screen shows but not how it idles.

- **A photo frame**: the slideshow, with the widgets arranged for it (see [The photo frame](#the-photo-frame)). Once it is chosen, **Arrange the photo frame** opens its arrangement on the canvas.
- **The night sky**: the stars, Milky Way, constellation figures and moon as they are outside right now, worked out from the household location in *Settings > General* and drawn over a treeline on the horizon. As at a real dusk, the Milky Way is the last thing to appear, and it fades when the moon is bright. Once it is dark, one constellation at a time is drawn in, line by line outward from its brightest star (the way you would find it outside). Then it is named, with what the name means and the names of its brightest stars, for about twenty seconds. The next one follows after a pause. Each display remembers which constellations it has shown and picks the one shown longest ago, best known first, skipping any that a widget would cover, so over the nights of a season it gets through all of them. The brightest stars twinkle, and a shooting star crosses every few minutes. On the nights around the peak of one of the ten major yearly meteor showers (the Quadrantids, Lyrids, Eta Aquariids, Southern Delta Aquariids, Perseids, Draconids, Orionids, Leonids, Geminids and Ursids), while its radiant (the point the meteors seem to come from) is above the horizon, a line at the top says so, for example "Geminids peak tonight, up to 150 an hour", and mentions whether a bright moon will hide the fainter ones. A small ring marks the radiant when it is in view, and shooting stars come more often and streak away from it. During a lunar eclipse visible from home, the moon turns copper as it moves into the Earth's shadow. If **Say when aurora may be visible** is ticked in *Settings > Appearance > Night sky* (off by default, one switch for every display), a second line says when NOAA's aurora forecast gives a chance of aurora overhead or low on the horizon toward the pole ("Aurora possible now, low in the northern sky"). When the device is set to reduced motion, or the performance level is Reduced or Minimal, the twinkling and shooting stars stop and each constellation appears whole instead of being traced. In the daytime it shows a plain sky. It loads no images and redraws once a minute, so it costs next to nothing on a display that never sleeps, and visitors see no family photos.
- **Night**: from dusk to dawn, half an hour after sunset until half an hour before sunrise where the household is, or at set times on the display's clock, such as 21:00 to 06:30. When idle > **Advanced** > **Night is** picks which, shows tonight's real times, and under them you can move each edge earlier or later by some minutes or hours. Near midsummer, far from the equator, dusk and dawn are only a few hours apart and large offsets can make the night end before it starts. The editor warns you and won't save a setting like that. While idle, the display checks every minute whether night has begun. The same night also turns Glance's ink warm and brings up its veil, and it is when the screen dims.
- **Screen off**: a black screen until someone touches it, for a bedroom or a hallway.

All of this is worked out on the display from the date and location, and nothing is downloaded, apart from the aurora forecast when that is switched on. The server fetches the forecast from NOAA's Space Weather Prediction Center at most every 30 minutes, and only while a display is showing the night sky after dark. If NOAA doesn't answer, the line is left off. The forecast is read for the household location, so it needs a location set in *Settings > General*. Without a location, Prism uses the time zone to estimate it, and the change at sunset is then right to within about an hour.

#### The photo frame

The photo frame is a photo slideshow with widgets on top, such as the clock, the weather and the calendar. Which widgets show and where is the dashboard's own photo frame arrangement: the Kitchen dashboard can have a big clock, the weather and a slow photo cycle, while the Main dashboard has a smaller clock and tomorrow's calendar. A screen that idles as a photo frame shows the arrangement of the dashboard that is up.

The arrangement is saved with the dashboard, not in the browser, so a screen showing that dashboard picks up a change made on another device, such as a phone or a laptop, within a minute, without a reload. Arrange it from More > Edit layout > Screen > When idle > **Arrange the photo frame** (see [Photo frame arrangement](DASHBOARD.md#photo-frame-arrangement)).

#### Widget transitions

By default the photo frame shows every widget in its arrangement all the time. It can instead show some of them and rotate which ones are up, so the board changes slowly. That is easier on the panel, because nothing sits in one place for hours, and it gives the photo frame something to do besides change photos.

**Transition effect** (see [Configuration](#configuration)) offers four ways for a widget to come and go:

- **Fade**: the widget fades in and out, easing at both ends. Arriving and leaving are not mirror images on purpose: a widget appears at once and settles, and it pauses a moment before it goes.
- **Smoke**: the widget itself dissolves. A turbulence mask thins out its own pixels in soft-edged patches, and nothing is drawn on top of it.
- **Fill and drain**: a waterline crosses the widget, with a surface that keeps moving and bubbles rising through it. One widget drains while another fills, and the two match exactly, so the water leaving one is the water arriving in the other. Only one pair moves at a time, and the two widgets are picked from opposite sides of the board so it looks like water passing between them and not one column doing something odd.
- **Fireworks**: the widget breaks apart into its own pixels. Prism samples it pixel by pixel and turns each sample into a fragment with that pixel's colour, so at the moment of the burst the fragments are the widget. It winds up first: the card puts down its background, the widget swells and pulls back in, and then it bursts. The fragments speed up as they scatter and cool to embers.

Fireworks is the only effect with a real cost. It switches to a plain fade automatically on hardware that reports itself as low-end, and whenever the display asks for reduced motion.

#### Drift

Separately from the transitions, the widgets that are showing move very slowly in a figure eight, 4 px each way over a minute and a half. This is for the panel. Rotating which widgets are shown helps against burn-in, and moving the ones that are up helps more, because it shifts their edges as well as what is inside them. Drift also runs on the dashboard, quieter, when it is the idle look.

All widgets move together, so the gaps between them stay as you designed them. The movement is in whole pixels, since moving by part of a pixel leaves the same physical pixels lit and does nothing. Four pixels is enough to move thin outlines and text clear of where they were. It can't move a thick stroke such as the clock's digits fully off its pixels, and any more movement would start to be noticeable.

#### Darker at night

At night a screen that is idle gets darker: a black layer eases in over a few seconds on top of the photo frame or the quieter dashboard, and a touch lifts it. Night and the darkness are the screen's own, both in Screen > When idle: **Darker** in the At night column, and when night is under **Advanced**. Choosing a night look never changes the darkness.

#### New and unnamed screens

The household keeps a starting day: what a screen shows idle by day and at night, when night is, and how much darker it goes at night. Set the looks and the darkness in *Settings > Screens > New and unnamed screens show*, beside the dashboard those screens show; they save at once. A device with no name idles by it until something is changed in its own editor. When a device is named, the screen keeps the day the device had, once, and holds its own from then on. On a new install the starting day is the dashboard, quieter, by day and at night, from dusk to dawn, 50% darker at night. On an upgrade it is what the default dashboard showed idle, not darker, and each named screen keeps how it idled on its normal dashboard and how much darker it went at night.

A web page can't change the panel's own brightness or turn it off. On an OLED panel the black layer really does dim it. On an LCD the backlight stays on, though less light reaches the room. A screen that should go fully dark at night still needs the computer's own display sleep.

#### Configuration

A screen's own idle settings are in its editor, More > Edit layout. From a phone, **More > Edit a screen** opens the same editor for that screen.

In More > Edit layout > Screen > When idle:

- **Idle after**: how long nobody touches the screen before it goes idle. 30 sec, 1 min, 2 min, 10 min, 1 hour or **Never** (default 2 min).
- **Darker**, at night: **Not darker**, or 25%, 50% or 75%. A new install starts at 50%; a screen that never set one is not darker. It isn't offered when the night look is **Screen off**.

Under When idle > **Advanced**, after when night is, the photo frame's motion:

- **Transition effect** and **Change every**: which effect to use, and the shortest gap between changes. It is a minimum because a new rotation never starts before the last one has finished, so a long effect sets its own pace.
- **Show at least** and **at most**: the fewest and most widgets on screen at once. By default about two thirds of the layout shows, within those limits.
- **Outlines on the photo frame**: off removes the border around each widget. Lines inside a widget are left alone.
- **Transition length**: Brisk, Normal, Slow or Very slow. It scales every effect at once.
- **Carbonation**, **Keep text clear of the waterline**, **Surface wobble**: for fill and drain only. Keep text clear of the waterline decides whether the water surface passes over the top line of a widget's text or over the empty space above it. Some people like seeing the water cover the content and others see it as a fault, so it is left as a switch.
- **Drift**: on or off, on by default.
- **Change photo every**: how often the photo changes, from 5 seconds up to 1 hour, or Never for one still image.

In More > Edit layout > Screen > **Advanced** are the screen's **Orientation**, **Performance**, **On-screen keyboard**, **Auto-hide navigation** and **Notices**, and:

- **Sign out after**: how long the display can sit untouched before it stops being signed in as whoever used it last. The choices run from 5 minutes up to 4 hours, or Never, and the default is 30 minutes. Like the other settings here, it belongs to this screen.

  Signing out leaves the screen showing everything. `getDisplayAuth` keeps serving the dashboard as the configured display user, so anyone who walks up can still read the calendar, tasks and messages. What returns is the PIN prompt on anything that changes something.

  The reason for this setting: a parent session lasts 7 days, its window is renewed on every request, and the dashboard polls all the time. Without this timer, one sign-in would leave the display signed in as that person until the 30-day hard limit, and whoever walked up next would get their access.

  It is kept separate from **Idle after** on purpose. Going idle only changes the look and is often set for two minutes, and people who get asked for a PIN that often soon resent it.

#### Changing it from the photo frame

To judge a transition you have to watch it. A screen whose settings shortcut was turned on before keeps a Prism mark in the top-left corner of the photo frame. It is invisible until you hover over it, then fades in over two seconds, and it opens the motion settings in place. On a touchscreen you can tap that corner even when nothing is drawn there.

All of these settings belong to the screen where you set them, so two screens in one house can run different effects.

The photo frame's *arrangement*, meaning which widgets show and where, is arranged in the editor too (see [Photo frame arrangement](DASHBOARD.md#photo-frame-arrangement)), from the same When idle rows as its motion, because arranging a photo frame and choosing how it moves are two parts of the same job.

You choose which photos appear under *Settings > Photos:*

- **Source filter**: which photo sources to use.
- **Pinned photo**: show one fixed photo in place of the slideshow, for places you want to stay the same.

#### Going idle

- Any mouse, touch or keyboard activity restarts the wait.
- Whether the tab is visible makes no difference, and a tab that is on screen with nobody using it still goes idle. That is the kiosk case: nobody is using the wall screen, so it shows its idle look.
- **More > This screen > Idle now** makes the screen go idle at once.
- A screen doesn't go idle when:
  - Its editor is open, on the screen or from a phone.
  - A modal is open.
  - It is phone-sized. A phone never idles; it dims and locks itself.

#### Back to in use

- Tap anywhere, press a key or move the mouse, and the screen fades back to the dashboard.
- No PIN is needed, so anyone can wake it.

### Away Mode

Away mode is a privacy cover for when nobody is home, or when you don't want someone passing by to see what's on the dashboard. It shows only a photo slideshow and a small header bar with the clock and weather.

#### Why this exists

Say your dashboard hangs in a kitchen you can see from the front door. A delivery driver, a neighbour or a visiting house sitter glances through the window and sees the family calendar, today's chores and which tasks are due. That is more than a stranger should see.

Away mode cuts the screen down to the clock, the weather and a photo.

#### Activation

There are two ways to turn it on:

1. **Manual**: open **More** on the dock and tap **Away mode** under **This screen** (on a phone, under **Screens**). Prism asks for a parent's PIN, and then the mode starts.
2. **Auto**: set **Turn on after** in the **Away mode** card in *Settings > Appearance*. It is one setting for every screen in the house:
   - **Never (only by hand)**: never turn on by itself.
   - **4 hours** without any use, then it turns on.
   - **8 hours** without any use, then it turns on.
   - **12 hours** without any use, then it turns on.
   - **1 day** without any use, then it turns on.
   - **2 days** without any use, then it turns on.
   - **3 days** without any use, then it turns on.
   - **1 week** without any use, then it turns on.

Any touch, click or key press restarts the auto timer. Only a named screen, a trusted device or a screen with someone signed in turns Away mode on by itself.

#### The Away Mode display

- A header bar across the top:
  - The clock on the left.
  - The weather on the right, with the current temperature and conditions.
  - Both are compact and fit on one line.
- Below that, a full-screen photo slideshow.
  - It uses the photos tagged for the photo frame, with the same filter.
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

You fill it in under *Settings > Babysitter Info.* The sections are:

- **Emergency contacts**: phone numbers for parents, grandparents, the doctor, the school, poison control and emergency services. Tap a number to call it, if the device can make calls.
- **House info**: the WiFi name and password (with a QR code to join in one tap), door codes, security system codes, the garage code, the address and the nearest cross street.
- **Per-child info**: allergies, medications and when to give them, bedtime, dietary restrictions and any special notes ("Sophie won't sleep without her bunny").
- **House rules**: anything you want the caregiver to know, such as screen time, snacks or what to do in a given situation.
- **Pet info** (if you set it up): feeding times, where the pet food is kept and the vet's contact details.

#### Sensitive sections

You can mark any section as **sensitive** in *Settings > Babysitter Info.* A sensitive section still appears on the screen, but a parent PIN is needed to reveal it. Some places this helps:

- Door codes you don't want on show if someone outside the family walks through.
- The WiFi password, if lots of people get to see the babysitter screen.
- A child's medical details, if you only want the caregiver to see them when they need them.

A sensitive section shows a placeholder ("Tap to reveal: parent PIN required") until someone unlocks it, and then it stays visible for that session.

#### Activation

There are two ways to turn it on:

1. **Open More** on the dock and tap **Babysitter mode** under **This screen** (on a phone, under **Screens**), then enter a parent's PIN.
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

- Idle, the screen shows its idle look: the dashboard, quieter, a photo frame or the night sky.
- Away mode shows the photo slideshow, clock and weather, with no widgets.
- Babysitter mode shows the babysitter information full screen, with no slideshow.

You turn Away mode and Babysitter mode on from **More > This screen**, where **Idle now** also makes the screen go idle at once. Away mode and babysitter mode need a PIN to leave before you can switch.

### Performance considerations

The photo frame, the night sky, away mode and babysitter mode each load only when they are needed, and not every time the dashboard draws. In v1.0.4 the chain of imports that had pulled them into the root layout was cut, to keep the dashboard's first paint fast.

At the Reduced and Minimal performance levels (**Performance** in More > Edit layout > Screen > Advanced, set for each screen):

- The photo frame's Fireworks effect becomes a plain fade, and the night sky stops twinkling.
- At Minimal, the fades between idle and awake are almost instant.
- Away mode and babysitter mode run as usual.

### Privacy summary

| Mode | Shows | Reachable without login? |
|---|---|---|
| Dashboard | Everything (calendars, tasks, etc.) | Yes, but read-only |
| Idle | The dashboard, quieter, a photo frame or the night sky | Same as dashboard |
| Away Mode | Photos + clock + weather only | After timeout / manual activation |
| Babysitter Mode | House info + contacts + child notes + today's meals, sitter can leave a note | Yes, via `/babysitter` URL |

If you're worried about what someone passing by can see, use Away mode and set it to turn on after a time that fits how you use the screen.

If you need to give a babysitter or short-term guest the information they need, use Babysitter mode.

### Troubleshooting

#### The screen doesn't go idle

- Check **Idle after** in More > Edit layout > Screen > When idle. **Never** keeps the screen in use.
- Check whether the editor is open, which keeps the screen in use.
- Check whether a modal is open, which also stops it.
- In an installed app, the screen goes idle by itself only once it is named in its editor (More > Edit layout > Screen > Shows > **Normally** > **Edit**, which asks for a name). On a phone it stays off, on purpose. Name the wall screen if it runs as an installed app.

#### Away mode won't exit

You need the parent PIN. If you've forgotten it, reset it offline with the script inside the app container. Run `docker compose exec app node scripts/reset-pin.js --list` to see member names, then `docker compose exec app node scripts/reset-pin.js "Name" 1234` to give that member a new PIN.

#### Babysitter info shows blank

Nothing has been filled in under *Settings > Babysitter Info.* Add at least one section so the page has something to show.

#### Sensitive section won't unlock with the right PIN

Check that the PIN belongs to someone with the **parent** role. A child's PIN can't unlock sensitive sections.

#### Public /babysitter URL not loading

Make sure at least one section is filled in under *Settings > Babysitter Info*, because an empty babysitter view has nothing to show. Also check that the device can reach the Prism host on your network.

#### The photo frame stutters

The screen may be running at the Minimal performance level, where the Photo widget shows a single image. Look at **Performance** in More > Edit layout > Screen > Advanced. On **Auto** the screen steps down a level by itself when its fades keep stuttering. While it runs below Full, a **Performance** tile shows in **More > This screen**, and a tap on it sets Full.

#### Wrong photos on the photo frame

The photo sources are in *Settings > Photos*, and the photo pinned for the photo frame is under *Settings > Photos > Pinned Photos > Photo frame*. In the lightbox, **Tag for: Photo frame** decides whether a photo can appear there.

#### Babysitter QR code for WiFi doesn't work

The QR code uses the standard `WIFI:` URI format. Some older Android devices can't join Wi-Fi from a QR code, and on those the sitter has to type the password. Before blaming the QR code, check that the password works when typed in.

#### Clock in away mode showing wrong time

This comes from the browser's time zone. The away-mode clock uses the browser's local time zone, so check the system time zone on the device running the dashboard.
