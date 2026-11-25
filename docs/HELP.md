# Guide

The guide gives every Prism feature its own page. Once setup is done, start here: each section below sums up one feature and links to its full page.

---

## First-time setup

Setup takes five steps:

1. Install Prism by following the [installation guide](getting-started/install.md).
2. Add your family members under **Settings > Family Members > Add Member**. Each one gets a name, colour, avatar, role (parent or child) and their own 4- or 6-digit PIN. Pets are added in the same section.
3. Set the PINs. Each member chooses a 4- or 6-digit PIN in the setup wizard when you first install, and can change it later in **Settings > Security**. A member who would rather sign in with letters can use an alphanumeric PIN instead: in **Settings > Family Members**, edit the member and pick **Passcode**, 6, 8, 10 or 12 lowercase letters and numbers. A fresh install opens straight into the setup wizard, since there is no default PIN to log in with. The optional demo family uses `1234` for everyone, so change those PINs before you use Prism for real.
4. Connect integrations under **Settings > Integrations**. Most families connect at least Google Calendar, weather (Open-Meteo is the default and needs no setup) and OneDrive. The [first-time setup walkthrough](getting-started/first-time-setup.md) has more.
5. Arrange the dashboard: tap **More > Edit layout** in the dock at the bottom of the screen, and move the widgets where you want them.

After setup, install Prism as a PWA (a web app you can add to the home screen) on phones and tablets. The [Mobile guide](features/MOBILE.md) shows how.

---

## Logging in

Tap your avatar and enter your PIN, which is 4 or 6 digits depending on how it was set. The PIN goes in as soon as you type the last digit. You can also use a keyboard (0-9, Backspace and Enter). A member with an alphanumeric PIN gets an **ABC** key on the pad, which shows the letters, and **123** to go back; letters typed on a keyboard work too. Each time you use Prism, your sign-in is extended: parents stay signed in for about 7 days after their last use and children for 1 day, up to a hard limit of 30 days for parents and 7 days for children.

A parent can keep a phone they use every day signed in for longer. In **Settings > Security > Signed-in devices**, tap **Keep signed in**: that device then stays signed in for 30 days from its last use, up to a year from sign-in. The same card lists the parent's other signed-in devices, with **Sign out** on each and **Sign out all other devices**.

---

## Roles

| Action | Parent | Child |
|---|---|---|
| View dashboard & pages | Yes | Yes |
| Complete chores | Yes (auto-approved) | Yes (pending parent approval when the chore requires approval, otherwise approved at once) |
| Approve chores | Yes | No |
| Edit settings | Yes | No |
| Manage family members | Yes | No |
| Redeem goals | Yes | No |
| Exit Away / Babysitter Mode | Yes (parent PIN required) | No |
| Add tasks, messages, wishes | Yes | Yes |
| Delete others' messages | Yes | No |
| Generate API tokens | Yes | No |

There is also a third role, guest, for shared displays and kiosks. A guest can look at the dashboard and pages and cannot change anything.

---

## Features

### [Glance](features/DASHBOARD.md)

Glance is the built-in dashboard and the front page on a new install. It draws the day as one scene over the photo: the date and clock, the weather as one line, **Next** and **Later today**, the coming days as short sentences, and quiet lines for chores left, the shopping list and a birthday coming up. It can be edited like any dashboard: its **Widgets** sheet in the editor chooses which parts show, and **Show the day as an arc** draws the day as the sun's path instead of a list. Glance can be reset to its default but not deleted.

### The dock

The dock is the row of pages along the bottom of every page, with **More** and **Sign in** at its end. On a wall dashboard it hides behind a small **Menu** tab on the bottom edge, and a tap anywhere brings it back. **More** holds three groups: **This screen** (Edit layout, Reload, Babysitter mode, Away mode, Screensaver), **Pages** (the pages that are not on the dock) and **Prism** (Settings, Help, sign in). On a phone it holds **Pages**, **This phone** (Cards, Reorder, Reload), **Screens** (Edit a screen, Away mode, Babysitter mode) and **Prism**, and the round button above the dock is only the page's Add. Which pages sit on the dock is chosen in **Settings > Features**.

### [Calendar](features/CALENDAR.md)

The calendar pulls from Google (signed in with OAuth) and from iCal subscriptions. It has seven views (Agenda, Day, List, Schedule, 2W, Month and 3 Months). You can drag events to move them, and tapping an event on the Calendar page, Glance or the dashboard widget opens its event sheet, with **Edit** and **Delete**. The server syncs on a schedule, and there are calendar notes, hidden hours and a **View** menu. On a phone, only the Agenda view is shown.

A parent can hide an event in Prism and leave it in its calendar, using **Hide in Prism** in the event sheet. On a screen where nobody is signed in, the tick asks for a parent's PIN. On a recurring Google, iCal or CalDAV event, they can hide the whole series. Hidden events and series are listed under **Hidden events** in **Manage calendars** (on the Calendar page, in the **View** menu), each with **Unhide**. The same window lists birthdays and milestones, each with **Remove**, and a synced birthday you removed can be brought back from **Removed birthdays**.

### [Shopping](features/SHOPPING.md)

Keep several lists, each laid out by category. Tap an item to cross it off; it moves to **Checked off**, and the pencil at the end of its row edits or deletes it. You can scan barcodes with the camera or a USB scanner, sync lists both ways with Microsoft To Do, and send a list to your online Kroger cart at any Kroger banner with one click. The dashboard and screensaver widget hide checked items, and an item ticked by mistake stays for five seconds so you can untick it.

### [Recipes](features/RECIPES.md)

Import recipes from a web address (any page that uses the schema.org recipe format), from Paprika, or by pasting text. Pasting works well with text read from a photo (OCR), and it keeps ingredient sections. You can upload a photo for each recipe and scale it with the ½× to 4× pills, and "Add to Shopping List" adds the ingredients at the scale you picked.

### [Tasks](features/TASKS.md)

Tasks are to-do items that you can assign to someone and give a due date, a priority and a list. They group by person and then by list, and sync both ways with Microsoft To Do or Google Tasks. Google Tasks subtasks and Microsoft To Do steps come in indented under their task, and a tick on either side reaches the other.

### [Chores](features/CHORES.md)

Chores are household jobs that come round again, each with a person, a frequency and points. The Chores page opens on what to do today, tomorrow and later this week, and parents set chores up behind **Manage**. A chore can need a parent's approval before its points count. A chore can also be **For** a pet, added under **Settings > Family Members**, and then says who did it today. When **Require the PIN for every change** is off, a named wall screen can tick chores without a PIN.

### [Goals & Points](features/GOALS.md)

Kids earn points from approved chores. Parents set goals that repeat, such as an allowance, or happen once, such as a LEGO set. Points fill the goals one after another in priority order, and a seasonal animation plays when a goal is reached.

### [Messages](features/MESSAGES.md)

Messages is the family message board. You can post a message, pin it, mark it important, set when it expires, edit it where it is and group the board by person.

### [Wishes & Gift Ideas](features/WISHES.md)

Each member has a wish list, and others can claim an item in secret. Gift-givers can also keep private notes of gift ideas.

### [Photos](features/PHOTOS.md)

Upload photos directly or sync them from OneDrive, choosing folders with a folder picker. The location stored in each photo feeds the Travel Map photo strip. The screensaver, the dashboard wallpaper and the slideshow widget all use these photos. On the wallpaper and the screensaver, each photo crossfades into the next with a slow Ken Burns zoom, and a small line can say when and where it was taken.

### [Travel Map](features/TRAVEL.md)

The travel map is an interactive 3D globe for places you have been, places you want to go and trips with several stops (as a route, a loop or a hub). Photos that carry a location link themselves to nearby pins.

### [Weekend Ideas](features/WEEKEND.md)

Weekend Ideas is a family board of local places to visit. Keep a list of ideas, mark places as visited, and add ratings, tags and favourites.

### [Bus Tracking](features/BUS.md)

Bus Tracking predicts when the school bus will arrive by reading FirstView emails in Gmail. It adjusts how often it checks, finds routes on its own and keeps separate morning and afternoon trips for each student. With a walk time set on a route, the Now & Next widget says when to leave for the stop.

### [Display Modes](features/DISPLAY-MODES.md)

There are three modes that cover the dashboard. Screensaver runs when the screen is idle, Away Mode hides the family's information for privacy, and Babysitter Mode shows what a sitter needs. While Babysitter Mode is on, the sitter can leave a note for the family on the Messages board.

### [Themes](features/THEMES.md)

Choose one of seven colour palettes under Settings. The palette is set once for the whole house, and each screen keeps its own Light or Dark, set in its editor (More > Edit layout > Screen > Light or dark). Settings > Appearance > New screens start as is what a newly named screen starts as. Every palette is checked for readability before it ships. Adding `?theme=default` to the address resets a display that has no keyboard.

### [Mobile & PWA](features/MOBILE.md)

Prism installs as a PWA on iOS, Android and desktop. On a phone you get a floating add button in the corner (the FAB), a simpler one-column dashboard and the calendar as an agenda.

### Integrations

- [Kroger / Mariano's cart push](features/KROGER.md) sends your shopping list to your online cart at any Kroger banner.
- [Home Assistant](home-assistant.md) can read Prism's data using the Voice API tokens.
- The [Voice API and Alexa skill](voice-api.md) page covers the `/api/v1/voice/*` endpoints, which need a token, and a personal Alexa skill you can ask "Alexa, ask Prism what's on today."

---

## Other features (covered inline below)

These smaller features have no page of their own, so they are described here.

### Meals

Meals is a weekly meal planner. Plan each meal by day and type (breakfast, lunch, snack or dinner). A meal can also have a time of day, which places it on the calendar; if you leave it blank, breakfast is at 7am, lunch at 12pm, snack at 3pm and dinner at 6pm. Link a meal to a recipe from the [Recipes](features/RECIPES.md) library, and opening the meal takes you to that recipe. Mark meals as cooked to keep track. You can drag meals between days, also in the dashboard Meals widget on a touch screen, and filter the week to one or more meal types with the breakfast, lunch, dinner and snack pills. To bring in a meal plan from Tandoor or Mealie, use **Add ▾ > Sync meal plan…**: you review and approve the meals, and they arrive with their recipes. The week starts on the day set in **Settings > General > Week Starts On**.

On a dashboard, a Meals widget too small for the whole week opens at the next meal: the next one today not yet eaten, or the first meal of the next day that has one. Meals that are over are greyed and sit above it, so scrolling up shows them. A meal is over an hour after its time (the time set on it, or else the usual time for its type above), so dinner stays the next meal until 7pm. As the day goes on, the list moves to the next meal by itself; after you scroll it, it stays put while you use it and goes back about 30 seconds after you stop. A widget that fits the whole week does not scroll. The Meals page always shows the whole week.

### Performance

Each screen runs at one of three levels, set in that screen's editor under **More > Edit layout > Screen > Advanced > Performance**. From a phone, open **More > Edit a screen** (with two or more screens, pick one in *Settings > Screens*), then **Screen > Advanced**.

- **Full**: every effect is on.
- **Reduced**: no backdrop blur, no full-screen celebrations or particle effects, a still night sky.
- **Minimal**: Reduced, plus the Photo widget shows one static image, refreshes come ~2.5× less often, and fades are near-instant.

**Auto** is the default. It starts at Full and times the fade each time the screen goes idle or wakes. After three choppy fades in a row it steps down one level and stays there. Picking a level by hand overrides it. While a screen runs below Full, a **Performance** tile shows under **More > This screen**, and tapping it puts the screen back to Full. A kiosk can set the level in its address with `?perf=auto`, `full`, `reduced` or `minimal`.

---

## Settings reference

This is a short tour of **Settings**. Where a section belongs to a feature, that feature's page above covers it in full.

- **Account & Profile** shows the current session and the default display user.
- **Family Members** is where you add, edit and remove members and set their names, colours, avatars, roles and order. Each member signs in with a **PIN** (4 or 6 digits) or a **Passcode**, an alphanumeric PIN of 6, 8, 10 or 12 lowercase letters and numbers; a child who cannot spell yet is better on a PIN. **Pets** are listed here too, each with a name, a kind (cat, dog or other) and a colour. A pet has no sign-in or points, and a chore can be **For** a pet. Pick a colour from the 18 presets, or tap the rainbow swatch to choose any colour with the sliders or a colour code, then tap **Done**. The panel shows each colour next to every other member's. A colour another member already uses, preset or custom, shows that member's initial, and two members can still share it.
- **General** sets the weather location (city or postal code), the time zone and **Week Starts On**.
- **Integrations** has one card for each provider: Google (Calendar, Tasks), Microsoft (To Do, OneDrive), Gmail (bus tracking), Apple / CalDAV and Kroger (shopping cart push), plus **Photo Sources**. You choose which task, shopping and wish lists sync inside the Microsoft or Google card.
- **Appearance** is in three groups. **Look** has **Color Scheme** (this screen's Light or Dark, with System on a browser that is not named, and **New screens start as**) with the **Palette**, and **Seasonal Theme**. **Background and away** has **Background Wallpaper**, **Away mode** (how long the house sits idle before it turns on) and **Night sky**. **All screens** has **Units** and **Language**.
- **One screen's own settings** are in that screen's editor (**More > Edit layout**), not in Settings. **Screen** has it all, with its name in the editor's header: what it shows (**Shows**: **Normally** and its times), how it idles by day and at night (**When idle**: **Idle after**, what it shows, **Darker** at night, and under **Advanced** when night is and the photo frame's motion), light or dark, the photos behind the dashboard, and under **Advanced** its **Orientation**, **Performance**, **On-screen keyboard**, **Auto-hide navigation**, **Sign out after** and **Notices**.
- **Screens** lists every named screen, whether it is on, and its sentence, the one its **Screen** tab starts with (for example "Hallway shows Main. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker."), with **Edit**, **Rename** and **Remove**. **Edit** opens that screen's editor; from a phone, **More > Edit a screen** gets there too. A screen is named from its own editor: on the screen, open the editor, then **Screen** > **Shows** > **Normally** > **Edit**, which asks for a name first (for example "Kitchen"). A named screen keeps its idle, performance, keyboard and screen-shape settings under its name, so after a browser is reset it can take them back there with **Or it is**. Below the list, **New and unnamed screens show** picks the dashboard a browser nobody has named shows, and its idle look by day, at night, and how much darker at night. A screen named later starts with that idle and night look, then keeps its own. Like the rest of Settings, these save at once.
- **Photos** manages sources (Local, OneDrive, Immich), with a folder picker, **Captions and On this day** (**Show when photos were taken**, **Show where photos were taken** and **On this day**, for every screen), a target resolution for the low-resolution warning, GPS backfill (adding locations to older photos) and the pinned wallpaper and screensaver photos.
- **Bus Tracking** covers the Gmail connection, route setup, finding routes automatically and the Gmail label filter.
- **Input** has switches for the on-screen keyboard and the barcode scanner. The keyboard switch here is for all screens. To choose **Always** or **Never** for one screen, such as a tablet with its own keyboard, use **On-screen keyboard** in that screen's editor under **Screen > Advanced**.
- **Babysitter Info** holds emergency contacts, house info (the WiFi password is stored encrypted with AES-256-GCM), child info and house rules.
- **Features** shows or hides each page in the navigation, and picks the pages on the dock: Home and up to five ticked with **On the dock**. The rest are in **More**.
- **Security** holds the PINs and API tokens, with a choice of Voice or Full scope for each token. **Require the PIN for every change** decides whether a wall screen asks for a PIN to tick a chore, a task or a shopping item, or to add a shopping item; it is on for existing installs and off for new ones. **Signed-in devices** keeps the device in hand signed in for 30 days from its last use and lists the other devices signed in as you, with **Sign out**.
- **Backups & Data** lets you create, download, restore or delete database backups. It also has destructive actions (**Truncate** and **Seed demo data**) that ask you to confirm first. On an install that started with the demo family, a **Demo data** card removes it.
- **Activity Log** is a log of every action taken in the app, which you can filter.
- **About** shows the version and links, and lets you run the setup wizard again.

> Calendar management (turning synced calendars on, assigning and colouring them, each calendar's display rules, iCal subscriptions, **Past Events** and **Calendar Hours**) has moved out of Settings. You now find it in **Manage calendars**, in the **View** menu on the Calendar page.

---

## Installing as PWA

The [Mobile & PWA guide](features/MOBILE.md) has the steps and tips for each operating system.

---

## Keyboard shortcuts

| Shortcut | Where | Action |
|---|---|---|
| 0-9 | PIN pad | Enter digit |
| Backspace | PIN pad | Delete last digit |
| Enter | PIN pad | Submit |
| Escape | Modals | Close |
| Ctrl+Enter | Message edit | Save |
| Ctrl+B | Calendar notes | Bold |
| Ctrl+I | Calendar notes | Italic |
| Ctrl+U | Calendar notes | Underline |
| Ctrl+Shift+S | Calendar notes | Strikethrough |
| Ctrl+Shift+L | Calendar notes | Bullet list |
| Delete or Backspace | Layout editor | Remove the selected widget (with Undo) |
| Arrow keys | Layout editor | Move the selected widget one cell, or resize it in resize mode |
| Ctrl+Shift+M | Layout editor | Toggle measure mode |

---

## Troubleshooting

Each feature page has its own troubleshooting section:

- [Calendar troubleshooting](features/CALENDAR.md#troubleshooting)
- [Shopping troubleshooting](features/SHOPPING.md#troubleshooting)
- [Recipes troubleshooting](features/RECIPES.md#troubleshooting)
- [Tasks troubleshooting](features/TASKS.md#troubleshooting)
- [Goals & Points troubleshooting](features/GOALS.md#troubleshooting)
- [Mobile & PWA troubleshooting](features/MOBILE.md#troubleshooting)
- [Kroger troubleshooting](features/KROGER.md#troubleshooting)

These problems come up often:

### Forgot PIN

A parent can set a new PIN for a child or guest without knowing the old one, in **Settings > Security > Change PIN**. Changing a parent's own PIN, or a co-parent's, still needs the current one. A parent who forgot theirs can be reset with `scripts/reset-pin.js` on the server.

### Stuck in Away or Babysitter Mode

A parent PIN exits both modes. If you forgot it, reset it by hand with `docker exec prism-db psql -U prism -d prism -c "UPDATE users SET pin='\$2a\$12\$...' WHERE role='parent';"`. The install guide has the details.

### "Failed to save" / "Failed to add"

Since v1.8, these messages include the reason the server gave. If you see "rate limit exceeded", wait a minute and try again. Other failures show the cause, such as a validation error or a database constraint.

### Widget not loading

Refresh the page, using Ctrl+Shift+R for a hard reload. If Prism is installed as a PWA, uninstall it and install it again.

---

## Support

- The documentation is at <https://sandydargoport.github.io/prism/>.
- Report bugs in [GitHub Issues](https://github.com/sandydargoport/prism/issues).
- The source code is in the [GitHub Repository](https://github.com/sandydargoport/prism).
- Prism is licensed under PolyForm Noncommercial 1.0.0, which makes it free for personal and non-commercial use.
