# The wall screen

Choose what the wall screen shows and where. Start from a premade layout, or arrange your own.

You can start from one of the built-in layouts, borrow one from the community gallery, or drag and resize the widgets yourself (calendar, weather, clock, meals, chores, photos and more). Each screen in the house can have its own layout.

A parent arranges layouts in the editor: the dashboard drawn on a canvas at the size of the screen that shows it, with the editing panels beside it. The editor is the same on every device, a phone included. A phone's own dashboard is a simpler page (see [On your phone](MOBILE.md)).

## Set it up

### Entering the editor

Open **More** on the dock, the row of pages at the bottom of the screen, and choose **Edit layout** under **This screen**. If the dock is tucked behind the small **Menu** tab on the bottom edge, tap the tab first. Signed out, **Edit layout** asks for a parent's PIN, and while a child is signed in it isn't there. From a page other than the dashboard it opens the screen's dashboard with the editor open.

The editor looks the same on every device. It opens on a canvas: the dashboard laid out at the size of the screen that shows it, scaled to fit the window, so what you arrange is what the wall shows. A header above the canvas says which screen you are editing and which dashboard the canvas has open, for example "Hallway screen · Editing Main dashboard", with a **...** menu for the dashboard's jobs. The controls sit in a column beside the canvas (below it on a phone), with one panel always open, and none of them covers the canvas: three tabs, **Screen**, **Widgets** and **Look**, with **Cancel** and **Done** above them.

- **On a named screen** (named in **Screen**, listed in *Settings > Screens*) **Edit layout** opens that screen's own editor, at its own size, on the dashboard it was showing. Its own settings (in **Screen**) reach it when you press **Done**, and it goes back to its dashboard.
- **On a laptop or any other device** it opens at the size of a screen that shows the dashboard. **Shown at** above the canvas picks another: a named screen or a common screen size.
- **For another named screen**, **Edit** on its row in *Settings > Screens* opens the same canvas at that screen's size, and changes reach the screen on **Done**. From a phone, **More > Edit a screen** gets there: one named screen opens its editor, two or more open *Settings > Screens*, and with none it opens the default dashboard's editor.

The header:

- The screen's drop-down lists every named screen, set to this one. Picking another opens that screen's editor, asking first when changes are not saved. The pencil beside it renames the screen in place: Enter or leaving the field saves it at once, as *Settings > Screens* renames one; Esc keeps the old name. Editing a dashboard with no screen, it says **No screen**, and on a device with no name, **Not named yet**.
- **Editing** lists every dashboard, Glance first. Picking another opens it on the canvas, on the same tab. It never changes what the screen shows, which is **Screen > Shows > Normally**.
- The **...** menu: **New dashboard**, **Make a copy**, **Rename**, **Export**, **Import**, **Share to the gallery**, **Reset** and **Delete** (see [Multiple dashboards](#multiple-dashboards)). On Glance it has no Rename, Import or Share, and Delete is off.

Each tab opens with a line that says whose settings it holds: "Hallway · This screen" on **Screen**, "Main · Every screen that shows it" on **Widgets** and **Look**. A section ends with at most one fold, named **Advanced**. What each tab holds:

- **Widgets**: the widgets on this dashboard, the selected widget's own settings, the templates and the community gallery.
- **Screen**, first: the screen's whole day, in rows (see [Which dashboard a screen shows](#which-dashboard-a-screen-shows-and-when-it-switches) and [Idle, away and sitter screens](DISPLAY-MODES.md)):
  - A line naming the screen, then one sentence that says what it does, for example "Hallway shows Main. On school days it shows Bus board around bus time and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker." It follows each change before **Done**, and says so when something will not happen, such as "It never idles, so it has no night look."
  - A strip of today: night shaded by the screen's own night, each time it shows another dashboard a band in the colour of the swatch on that row (never narrower than 12 pixels, so a short one still shows), and a line at now. The exact times are in the rows.
  - **Shows**: **Normally**, then the screen's times, in the order that decides an overlap, each with **Edit**.
  - **When idle**: **Idle after**, then **By day** and **At night**: what it shows, and how much **Darker** at night. **Advanced** has when night is and the photo frame's motion.
  - **This screen: light or dark, photos behind the dashboard**: **Light or dark**, **Photos behind the dashboard** and **New photo every**.
  - **Advanced**: **Orientation**, **Performance**, **On-screen keyboard**, **Auto-hide navigation**, **Sign out after** and **Notices**.

  On a device with no name, the idle rows work and apply to that device; **Normally** and **Add a time** ask for a name first, in place. Editing a dashboard with no screen, from a laptop say, there is no Screen tab, so nothing in the editor can change that device's own settings.
- **Look**: the dashboard's **Text size**, and under **All widgets** one **Fill**, **Outline** and **Text** colour for every widget (see [Text size](#text-size) and [Widget properties](#widget-properties)). On Glance it has the text size only, since Glance has no cards.

Over the canvas, the toggles **In use | Idle** and **Day | Night** pick which of the screen's four states it draws, each as the screen draws it, and the line under the canvas names it: "Main, idle, at night: a photo frame, 50% darker. 1280 x 800." (see [Idle, away and sitter screens](DISPLAY-MODES.md)).

Everything in the editor waits for **Done**, including the text size and the screen's own settings, on a device with no name too. A dot on a tab means that tab has changes you haven't saved, and **Unsaved changes** beside **Done** says so for the whole editor. **Done** saves everything and **Cancel** puts it all back. The header menu's jobs that make, copy, delete or import a dashboard are their own actions, as before, and a rename saves at once.

Opening another dashboard from **Editing**, or another screen from the screen's drop-down, with changes not saved asks first: **Save and switch** saves them and opens it, **Discard** opens it without them, and **Stay** keeps you where you are.

### Glance, the built-in dashboard

Glance draws the front page as one scene over the photo, without a grid of cards. A new install starts on it.

- The date and the clock at the top left, and the weather as one line ("Partly cloudy, high 79") at the top right.
- **Next** across the middle: the event under way or about to start, in its person's colour, with its time. **Later today** follows it.
- The coming days as short sentences at the bottom left ("Tomorrow  Soccer at 10."), two things a day.
- Quiet lines at the bottom right: how many chores are left today, with a ring in each person's colour that ticks a chore off; the shopping list's count, with a plus to add an item; and, when a birthday is two to seven days away, an offer to add a task to mail a card (**Add it** or **Not now**). A line with nothing to say drops out.

In portrait the clock and weather sit on top, the day across the upper middle, the coming days below it and the quiet lines at the foot. Tap an event's words to open it; a tap anywhere else only wakes the screen. By default, while the screen is idle, the sentences and quiet lines fade and **Next**, the clock and the weather stay. During the screen's night the ink turns warm and the photo is veiled.

Glance is edited in the same editor and stays the live scene while you edit, so each change shows at once. It places each part itself, so its **Widgets** panel has no grid. For each part (**Clock and date**, **Weather**, **The day and the coming days**, **Birthday nudge**, **Chores left** and **Shopping list**) it has **Show** and **Stays when idle**. For the whole scene:

- **Show the day as an arc**: draws the day as the sun's path in place of the list, with each timed event as a bead in its person's colour. Off by default.
- **Days ahead**: how many days the sentences cover, from 1 to 7.
- **Text size**: Normal, Large or Larger.

Under **Editing** Glance comes first. The header menu's **Reset** puts its parts back as Glance first had them. It can't be renamed or deleted. **Make a copy** saves its widgets as a dashboard of your own, which you arrange on the grid like any other. An install without Glance has **Add Glance** in the header menu.

### Built-in templates

In the **Widgets** panel, **Start from a template** loads a ready-made arrangement for you to rearrange. It asks first, since it replaces every widget on the dashboard, with its place, fill, outline and text. There are six templates, each in a landscape and a portrait version, and the panel lists the ones for the current screen shape. The photo frame has its own set (see [Photo frame arrangement](#photo-frame-arrangement)).

Every template follows the same plan. One widget is the hero of the board, usually the calendar; on photo boards the wallpaper itself is the hero. The other widgets are sized to their natural shape and grouped into two or three balanced zones, instead of an even grid of four.

| Template | What it's for | Widgets |
| --- | --- | --- |
| **Family Central** | The everyday board. | Calendar hero, a tall rail of upcoming events and birthdays, and a weather and clock strip. |
| **Calendar Focus** | When the schedule matters most. | A full-height calendar hero with a slim weather and clock rail. |
| **Command Center** | Everything on one screen. | Calendar hero plus weather, clock, messages, and columns for tasks and chores. |
| **Meal Planner** | A board for the kitchen. | Meals hero, a tall shopping list column, and a weather and clock corner. |
| **School Mornings** | A board for getting out the door. | Calendar hero, a bus departure countdown, weather, homework tasks and the lunch menu. |
| **Ambient** | Photos first. | Mostly empty on purpose: a couple of glass clock and weather accents float over open space so a photo **wallpaper** shows through as the hero. Use it with a photo wallpaper. |

Most templates fill the canvas exactly. **Ambient** leaves the middle open on purpose for the wallpaper.

> A brand-new empty dashboard gets an internal **Default** layout built around the weather. A fresh install has no calendar connected yet, so that layout leaves out the calendar hero. It isn't one of the templates.

### Community gallery

In the **Widgets** panel, **Browse the community gallery** shows dashboard layouts that other Prism users have shared. The gallery loads a community index and shows each layout as a card with a live thumbnail, its name, description, author, widget count and orientation.

- **Search**: type in the search box and press **Enter** to match layouts by name or description. The **×** button clears the box.
- **Filter by orientation**: tap **▭ Landscape** or **▯ Portrait** to see only those layouts, and tap again to clear it. The filter starts on the orientation of the dashboard you are editing. Layouts stretch to fill whatever screen shows them, so the exact resolution makes no difference. Orientation does matter, because a portrait layout gets bars down the sides on a landscape screen, and the other way round.
- **Preview**: each card draws a small copy of the board on a neutral "photo field", turned to fit so portrait boards don't spill over, with a badge for the orientation.
- **Apply layout**: puts that design on your dashboard, after asking, since it replaces every widget and its fill, outline and text.
- **Clear filters**: appears when a search or orientation filter finds nothing.

While you arrange the photo frame, the gallery shows photo frame layouts instead.

#### Sharing your layout with the community

To share a board you like, open the header menu and choose **Share to the gallery**. Fill in a name, author, description and orientation, and choose **Open GitHub Issue**. Prism opens a filled-in submission for you, from any instance including hosted ones. Once it is approved, your layout shows up in everyone's community gallery.

You need a GitHub account to submit to the gallery. Without one, use **Download file** in the same dialog and send the file any way you like, and the other household loads it with **Import**.

#### Copy the dashboard onto the photo frame

While you arrange the photo frame (**Screen > When idle > Arrange the photo frame**), **Widgets** opens with a line that says so, and **Copy from the dashboard**, which replaces the photo frame's arrangement with the dashboard's widgets. **Done** keeps it and **Cancel** puts the old one back. The photo frame can show fewer kinds of widget than the dashboard, so any it can't show are left out, and the confirmation lists them. **Back to the dashboard** shows the dashboard on the canvas again.

#### Export & Import

- **Export** (the header menu > Export) copies your current layout as JSON to give to someone directly. Where the page can't copy, it saves a `.json` file instead.
- **Share to the gallery > Download file** saves the layout as a `.json` file.
- **Import** (the header menu > Import) takes pasted layout JSON, or use **Choose file…** to load a downloaded one.

### Multiple dashboards

You can make a separate dashboard for each room or screen. **Editing**, in the editor's header, lists every dashboard; pick one to edit it. The header menu holds the rest:

- **New dashboard** asks for a name and what to start from: the Default Template, a copy of the current dashboard, or blank.
- **Make a copy** saves the dashboard you are editing as a new one, or over another one.
- **Rename** (saved at once) and **Delete** act on the dashboard you are editing.
- The dashboard new and unnamed screens show lives at **`/`**. Pick it in *Settings > Screens > New and unnamed screens show*; it saves at once.
- Named dashboards get URLs like **`/d/kitchen`** or **`/d/living-room`**.
- Each dashboard has its own widget layout, photo frame arrangement and text size.
- Bookmark a dashboard URL on a device that only shows that dashboard, so it opens straight to it.

#### Which dashboard a screen shows, and when it switches

A named screen shows one dashboard, and can switch to another for a while. Both are set in the screen's own editor, in More > Edit layout > Screen > Shows: **Normally** is its dashboard, shown outside its times, and each time is a row of its own under it, with a swatch in the colour of its band on the strip. **Normally** can be **Same as new screens**, which follows whatever *Settings > Screens* sets for new and unnamed screens. Two screens can show the same dashboard, and each keeps its own times.

- **Bus time** follows your bus routes: from 30 minutes before each route's time at the stop to 15 minutes after, on the route's days. A route due at 7:45 on weekdays switches the screen from 7:15 to 8:00. Change the route's time and the switch moves with it. The row lists the routes it follows and their days, and opened, the windows it will use. It still switches on a school holiday, because routes have no holiday calendar.
  - **Routes**: with two or more bus routes, the row has a chip for each, all on to begin with. Turn one off to leave that route out. With every route on, the switch also follows routes added later. One always stays on.
  - **From** so many minutes **before to** so many **after**: how long before the route's time the switch starts and how long after it ends, from 0 to 120 minutes.
  - A screen can have more than one bus switch, for example the morning route to one dashboard and the afternoon route to another.
- **Set times** has a from and a to, and its days (Monday to Sunday, any set). Times use the household time zone. One that ends before it starts runs past midnight, and one that starts and ends at the same time lasts all day.
- **Stays awake**, on each row: while the switch is on, the screen does not go idle, and if it was idle when the switch starts, it wakes on the switch's dashboard as if someone had touched it. It is on for bus time and off for set times to begin with; turn it either way on the row. A row with it on ends its line with "stays awake". When the switch ends, the screen goes idle after the usual time with nobody touching it. Waking this way is not opening a dashboard by hand, so the screen goes on following its switches.

**+ Add a time** and, if bus tracking is set up (at least one route in *Settings > Bus Tracking*), **+ Add bus time** add one; a bus row made before keeps its row either way; a screen can have up to 12. Higher rows win where times overlap, and the arrow on an opened row moves it up. A row that a higher one covers says so, for example "Covered by Bus time (Bus board) above, so it never shows." A row's dashboard list ends with **New dashboard...**, which makes a new dashboard there and then and switches the row to it. **Open** edits that dashboard. Nothing reaches the screen until **Done**, and **Cancel** puts it all back. **Editing**, in the header, only changes which dashboard the canvas has open, so editing another one never changes what the screen shows.

A device nobody named shows the dashboard set in *Settings > Screens > New and unnamed screens show* and never switches. To give it times, name it: open the editor on it, then **Screen** > **Normally** > **Edit** or **+ Add a time**, which ask for a name first.

Make a dashboard to switch to with **Make a copy** in the header menu and rearrange it there. When a switch starts or ends, the screen changes over in place: widgets that are on both dashboards slide to their new spots and the others fade. The change waits until nobody has touched the screen for a minute, and it never happens while someone is editing the layout. If you open another dashboard by hand, the screen keeps it until it next goes idle, or until a switch starts or ends, and then shows its own again. This works with no switches too. The screen never goes idle while its editor is open, on the screen or from a phone, so nothing dims or covers the editor. With reduced motion turned on the dashboards crossfade, and at the **Minimal** performance level they swap instantly.

#### Notices

A named screen can show small notice cards down the top right of its dashboard. In the editor, **Screen** > **Advanced** > **Notices** turns each kind on and sets how many minutes ahead it looks:

- **Bus**: the bus is due at your stop within the set minutes, using the live position where there is one and the emailed estimate otherwise. The card goes once the bus has passed the stop.
- **Event**: a timed event starts within the set minutes. The card goes when the event starts. All-day events never show.
- **Message**: someone posted a family message within the set minutes.

The newest card is on top, and up to four show at once. Prism checks for new messages every half minute and for events every minute. Tap the **×** on a card to dismiss it. The dashboard underneath stays where it is, and the cards cover it until they go. Cards only appear on dashboards. They also show while the screen is idle, where they turn dark, keep updating and go darker at night with the screen.

#### Saving

- **Done** saves the dashboard you are editing, with its photo frame arrangement, and the screen's own settings.
- **Make a copy** in the header menu saves it as a new dashboard.
- The header menu's **Reset** puts the default arrangement in place of yours: the **Default** layout on a dashboard, or the default photo frame arrangement while you arrange the photo frame. Nothing is saved until **Done**, and **Cancel** brings yours back.

### Text size

**More > Edit layout > Look > Text size** sets how large everything reads on the dashboard, in 13 steps from 75% to 150%, on every screen that shows it. It scales the whole board at once, separately from each widget's own **Size**, and does not change other pages. The canvas shows the new size at once, and **Done** saves it.

## Use it

### The layout grid

Prism places widgets on a fixed **design canvas** instead of your screen's actual pixels, so one design looks right on many screens:

- **Landscape** canvas: **48 columns × 27 rows** (16:9).
- **Portrait** canvas: **36 columns × 64 rows** (9:16).

On the live dashboard the box around your widgets is stretched to fill the real screen. A layout that covers the whole canvas therefore fills the display edge to edge at any resolution.

#### Placing and sizing widgets

- **Drag** a widget to move it on the grid.
- **Tap** a widget to select it; it is marked **Move**. Tap it again for resize mode, marked **Resize**, and drag the handles on its edges and corners. A third tap lets it go.
- With a widget selected, **Delete** or **Backspace** removes it, with **Undo** in the message that follows. The arrow keys move it one cell, or in resize mode make it wider or taller (right, down) or narrower or shorter (left, up). No key acts while you type in a field or hold Ctrl, Alt or Cmd.
- In the **Widgets** panel, **On this dashboard** lists each widget with its **X**, **Y**, **W** and **H**, for exact placement. Tap a widget's name there to pick it, as a tap on the screen does; the **×** beside the name hides it, and **+ Add widget** brings back a hidden one. A widget added new takes the fill, outline and text the other widgets all share; where they differ, it starts with the theme's default.

The widgets are **Clock, Weather, Calendar, Tasks, Chores, Shopping, Meals, Messages, Photos, Points/Goals, Birthdays, Wishes, and Bus Tracker.**

#### Widget properties

Pick a widget on the screen or in the list in the **Widgets** panel (**More > Edit layout > Widgets**); its settings are below the list, beside the canvas on a laptop and below it on a phone. Its row in the list is marked. If another panel is open, Widgets comes forward. With nothing picked, that place says so in one line. The settings style that widget on its own, and the canvas shows only the screen. The **×** beside the widget's name lets it go, as a third tap on it does. With the focus on a setting, **Delete**, **Backspace** and the arrow keys still act on the widget.

- **Colours**: which set of colours the Fill, Outline and Text swatches offer (Seasonal, Ocean, Sunset, Forest, Mono or Candy).
- **Fill**: **Default** (the theme's card), **Transparent** (no card: the words sit straight on the photo in light text with a soft shadow), **Frosted** (a white, blurred card), **Glass** (a see-through card over the photo, which the Ambient templates use), a colour from the palette, or **Custom**. Under the swatches, **Opacity** sets how strong the fill is, or **Blur** for Frosted.
- **Outline**: the border's colour and opacity, including **None** to remove the widget's border.
- **Text**: the text colour, and **Size** (S, M, L or XL).
- **Apply to all widgets**, under each of **Fill**, **Outline** and **Text**: puts this widget's fill, outline, or text colour and size on every widget of the dashboard, hidden ones too. The line under it says how many widgets differ, or that every widget already matches.
- **More > Edit layout > Look > All widgets** does the same without picking a widget: one **Fill** (Theme, Glass, Frosted or None), **Outline** (Theme or None) and **Text** colour (Theme, Light or Dark), each with **Apply to all** and a line that says how many widgets differ. It starts on the one most widgets have. To turn outlines off everywhere, pick **None** under **Outline**, then **Apply to all**.
- **Align**, for the clock and the weather, under **Text**: **Across** (Auto, Left, Centre, Right) and **Up/down** (Auto, Top, Middle, Bottom) set where the contents sit. On **Auto**, a small tile (a third of the width or less) that touches a screen corner hugs that corner, and any other tile is centred. A small weather tile shows the icon, temperature and condition on one line each, and the rest once the tile is wide enough.
- **Grid**, for the calendar: the strength of its grid lines and a background colour for its cells.
- **Stays when idle**: on, the widget stays when the screen is idle as the dashboard, quieter; off, it fades. The canvas shows the same as **Stays** or **Fades** when it draws the screen idle. The photo frame has its own arrangement, so its widgets have no such switch.
- **Hide when empty**: Prism doesn't draw the widget while it has nothing to show (no open tasks, no messages, an empty shopping list, no birthdays coming up, no meals planned) and brings it back when something arrives. Its space stays blank, so nothing else moves. It is on by default on the photo frame and on the dashboard, quieter, when idle, and off by default on a dashboard in use. Clock, Weather, Calendar, Photos and Travel always have something to show, so they don't have this option. In the editor the widget always shows, marked **Empty: hidden** when the live screen leaves it out.
- **Hide first on a small screen**: leaves the widget out on a screen below about three quarters of the design size, so the others have room.

### Preview mode

Press **Ctrl+Shift+M** to hide the editor's controls for a moment and see the board as it will really look. Click **Exit Preview** to go back. **Show Nav** and **Hide Nav** let you check it with and without the dock, which helps when tuning a layout for a wall display.

Each screen chooses how its dock behaves on a dashboard with **Auto-hide navigation**, in More > Edit layout > Screen > Advanced. On, the dock tucks behind a small **Menu** tab on the bottom edge and comes back with a tap. Off, it stays on screen and the dashboard ends above it.

### Photo frame arrangement

Each dashboard has its own photo frame arrangement, used when photos or the night sky show while the screen is idle. In More > Edit layout > Screen > When idle, choose **A photo frame** and press **Arrange the photo frame**: the canvas shows it idle and **Widgets** opens to arrange it. Picking **Idle** over the canvas (and **Night** for the night), then **Widgets**, gets there too. The templates and the community gallery switch to their photo frame sets as well.

The screen goes idle after the time set as **Idle after** in the same place: 30 sec, 1 min, 2 min, 10 min, 1 hour or **Never**, 2 min by default. The photo frame templates keep the calendar, or tonight's meals, as the hero, with small clock, weather and message accents over one clear area of the photo so the wallpaper stays the main thing.

See [Idle, away and sitter screens](DISPLAY-MODES.md) for more on idle, night and Away mode.

## Details

### Troubleshooting

#### Edit layout is missing from More

Only parents can edit layouts. While a child is signed in, **More** has no **Edit layout**: sign out, or sign in as a parent. On a phone, **More > Edit a screen** opens a screen's editor instead.

#### My layout doesn't fill the screen / leaves a gap

The live board stretches the box around your widgets to fill the display. If a layout leaves a gap, the widgets usually don't reach the edge of the canvas. Stretch the outermost widgets to the last row or column, or start from a template that fills the whole canvas.

#### Clicks at the top of the screen don't respond under browser fullscreen (F11)

In F11 fullscreen the browser keeps the top edge of the screen for its own controls, and that can swallow clicks on whatever sits there. Install Prism as an app, or just maximize the window, instead of using F11.

#### A community layout applied but looks empty

A community layout only holds widget positions and none of your data. Widgets such as the calendar or meals stay empty until that feature has data, for example once a calendar is connected.
