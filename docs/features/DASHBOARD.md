# The wall screen

Choose what the wall screen shows and where. Start from a premade layout, or arrange your own.

You can start from one of the built-in layouts, borrow one from the community gallery, or drag and resize the widgets yourself (calendar, weather, clock, meals, chores, photos and more). Each screen in the house can have its own layout.

A parent edits layouts in **edit mode** on a large screen. Phones don't show the editor and get a simpler one-column view instead (see [On your phone](MOBILE.md)).

## Set it up

### Entering the editor

Tap the **grid icon** (four squares) in the dashboard header to enter edit mode. Only members with layout-edit permission, which means parents, can see it.

Edit mode replaces the live board with a grid you can edit and shows two toolbars. A slim vertical one on the left holds Widgets, Templates, Community and Mini-map. The one on the right holds Preview, orientation, Screensaver, Save and the **More** menu. You leave edit mode by saving or by exiting it.

### Built-in templates

The **Templates** button loads a ready-made arrangement for you to rearrange. There are six templates, each in a landscape and a portrait version, and the picker offers the one that matches your current canvas. The screensaver has its own matching set (see below).

Every template follows the same plan. One widget is the hero of the board, usually the calendar; on photo boards the wallpaper itself is the hero. The other widgets are sized to their natural shape and grouped into two or three balanced zones, instead of an even grid of four.

| Template | What it's for | Widgets |
| --- | --- | --- |
| **Family Central** | The everyday board. | Calendar hero, a tall rail of upcoming events and birthdays, and a weather and clock strip. |
| **Calendar Focus** | When the schedule matters most. | A full-height calendar hero with a slim weather and clock rail. |
| **Command Center** | Everything on one screen. | Calendar hero plus weather, clock, messages, and columns for tasks and chores. |
| **Meal Planner** | A board for the kitchen. | Meals hero, a tall shopping list column, and a weather and clock corner. |
| **School Mornings** | A board for getting out the door. | Calendar hero, a bus departure countdown, weather, homework tasks and the lunch menu. |
| **Ambient** | Photos first. | Mostly empty on purpose: a couple of frosted-glass clock and weather accents float over open space so a photo **wallpaper** shows through as the hero. Use it with a photo wallpaper. |

Most templates fill the canvas exactly. **Ambient** leaves the middle open on purpose for the wallpaper.

> A brand-new empty dashboard gets an internal **Default** layout built around the weather. A fresh install has no calendar connected yet, so that layout leaves out the calendar hero. It isn't offered in the template picker.

### Community gallery

Click **Community** in the editor toolbar to browse dashboard layouts that other Prism users have shared. The gallery loads a community index and shows each layout as a card with a live thumbnail, its name, description, author, widget count and orientation.

- **Search**: type in the search box and press **Enter** to match layouts by name or description. The **×** button clears the box.
- **Filter by orientation**: tap **▭ Landscape** or **▯ Portrait** to see only those layouts, and tap again to clear it. The filter starts on the orientation of the dashboard you are editing. Layouts stretch to fill whatever screen shows them, so the exact resolution makes no difference. Orientation does matter, because a portrait layout gets bars down the sides on a landscape screen, and the other way round.
- **Preview**: each card draws a small copy of the board on a neutral "photo field", turned to fit so portrait boards don't spill over, with a badge for the orientation.
- **Apply layout**: puts that design on your dashboard.
- **Clear filters**: appears when a search or orientation filter finds nothing.

The gallery has separate **dashboard** and **screensaver** modes, so you browse screensaver layouts the same way.

#### Sharing your layout with the community

To share a board you like, open the **More** menu, click **Share**, fill in a name, description, author and orientation, and submit. Prism opens a filled-in submission for you, from any instance including hosted ones. Once it is approved, your layout shows up in everyone's Community gallery.

You need a GitHub account to submit to the gallery. Without one, use **Download file** in the same dialog and send the file any way you like, and the other household loads it with **Import**.

#### Copy between the dashboard and the screensaver

**More → Use as idle screen** replaces the idle screen's layout with the dashboard you are editing and switches to the Idle screen tab so you can check it. **Save** keeps it and **Cancel** puts the old one back. On the Idle screen tab the same item reads **Use as dashboard**. Both need photos or the night sky behind the idle screen, because a dashboard that acts as its own idle screen has no separate layout. The screensaver can show fewer kinds of widget than the dashboard, so any it can't show are left out, and the confirmation lists them.

#### Export & Import

- **Export** (More → Export) copies your current layout as JSON to give to someone directly.
- **Share → Download file** saves the layout as a `.json` file.
- **Import** (More → Import) takes pasted layout JSON, or use **Choose file…** to load a downloaded one.

### Multiple dashboards

You can make a separate dashboard for each room or display. The dashboard-name dropdown in the editor toolbar switches between dashboards and creates new ones.

- The **default** dashboard lives at **`/`**. **More → Set as Default** makes any dashboard the default.
- Named dashboards get URLs like **`/d/kitchen`** or **`/d/living-room`**.
- Each dashboard has its own widget layout, screensaver layout and orientation.
- Bookmark a dashboard URL on a device that only shows that dashboard, so it opens straight to it.

#### Different dashboards at different times

A named screen (*Settings → Displays*) can show other dashboards at set times, for example a morning dashboard with a large bus widget on school days. In *Settings → Displays*, **Schedule** on the screen's row lists its times. Each time shows one dashboard from a start to an end time on the days you tick. Outside all of its times the screen shows its own dashboard. Times use the household time zone. A time that ends before it starts runs past midnight, and one that starts and ends at the same time lasts all day. When two times overlap, the one higher in the list wins.

Make the dashboard for a time with **Save As** in the editor and rearrange it there. When a time starts or ends, the screen changes over in place: widgets that are on both dashboards slide to their new spots and the others fade. The change waits until nobody has touched the screen for a minute, and it never happens while someone is editing the layout. If you open another dashboard by hand, the screen keeps it until the next time starts or ends. With reduced motion turned on the dashboards crossfade, and at the **Minimal** performance level they swap instantly.

#### Notices

A named screen can show small notice cards down the top right of its dashboard. In *Settings → Displays*, **Notices** on the screen's row turns each kind on and sets how many minutes ahead it looks:

- **Bus**: the bus is due at your stop within the set minutes, using the live position where there is one and the emailed estimate otherwise. The card goes once the bus has passed the stop.
- **Event**: a timed event starts within the set minutes. The card goes when the event starts. All-day events never show.
- **Message**: someone posted a family message within the set minutes.

The newest card is on top, and up to four show at once. Prism checks for new messages every half minute and for events every minute. Tap the **×** on a card to dismiss it. The dashboard underneath stays where it is, and the cards cover it until they go. Cards only appear on dashboards. They also show over the screensaver, where they turn dark, keep updating and dim along with it.

#### Saving

- **Save** overwrites the current dashboard's layout.
- The arrow next to Save offers **Save As**, which makes a named copy as a new dashboard.
- **More → Reset** throws away unsaved edits and goes back to the last saved layout.

### Orientation

The orientation button in the editor toolbar switches between **Landscape** and **Portrait**. It flips the design canvas between the 48×27 landscape frame and the 36×64 portrait frame, so you can lay out each orientation separately to match how the display is mounted.

## Use it

### The layout grid

Prism places widgets on a fixed **design canvas** instead of your screen's actual pixels, so one design looks right on many screens:

- **Landscape** canvas: **48 columns × 27 rows** (16:9).
- **Portrait** canvas: **36 columns × 64 rows** (9:16).

On the live dashboard the box around your widgets is stretched to fill the real screen. A layout that covers the whole canvas therefore fills the display edge to edge at any resolution.

#### Placing and sizing widgets

- **Drag** a widget to move it on the grid.
- **Resize** it by dragging the corner handles.
- The **Widgets** button shows or hides each widget and lets you type exact `x / y / w / h` coordinates when you want precise placement.

The widgets are **Clock, Weather, Calendar, Tasks, Chores, Shopping, Meals, Messages, Photos, Points/Goals, Birthdays, Wishes, and Bus Tracker.**

#### Widget properties

Click a widget to select it, then use the **properties toolbar** to style that widget on its own:

- Background color, including a **frosted-glass** option that the Ambient templates use
- Opacity
- Outline, including **None** to remove the widget's border
- Text color
- Text size
- **Hide when empty**: Prism doesn't draw the widget while it has nothing to show (no open tasks, no messages, an empty shopping list, no birthdays coming up, no meals planned) and brings it back when something arrives. Its space stays blank, so nothing else moves. It is on by default on the screensaver and on a calm dashboard's idle screen, and off by default on a dashboard in use. Clock, Weather, Calendar, Photos and Travel always have something to show, so they don't have this option. In the editor the widget always shows, marked **Empty: hidden** when the live screen leaves it out.

### Mini-map & validation

Click **Mini-map** in the left toolbar for a small map of the whole layout. It shows where each widget sits and flags problems such as widgets that overlap or are too small. Click anywhere on the mini-map to scroll the grid there.

Next to it, a **device preview gallery** shows how your one design looks on each common screen size. That way you can check that one layout works on all your displays without keeping a separate design for each resolution.

### Preview mode

Click **Preview** in the right toolbar, or press **Ctrl+Shift+M**, to hide the editor controls for a moment and see the board as it will really look. Click **Exit Preview** to go back. The **Show Nav / Hide Nav** toggle lets you check it with and without the navigation sidebar, which helps when tuning a layout for a wall display.

To keep the screen clean all the time, turn on **Auto-Hide Navigation** in *Settings → Appearance*. The nav and toolbar then hide after a while without use and come back on a click or a key press.

### Screensaver layout

Each dashboard has its own screensaver layout. In edit mode, click the **Screensaver** button to edit the screensaver's widget arrangement. The Templates and Community pickers switch to their screensaver sets as well.

The screensaver starts after the screen has been idle for a time you choose, under *Settings → Appearance → Timers & Auto-Activation (Screensaver → Activate after)*. The options are **30s / 1m / 2m / 10m / 1h / Never**, and the default is **2m**. It shows a photo slideshow with your chosen widgets on top. The screensaver templates keep the calendar, or tonight's meals, as the hero, with small clock, weather and message accents over one clear area of the photo so the wallpaper stays the main thing.

See [Display Modes](DISPLAY-MODES.md) for more on the screensaver and Away Mode.

## Details

### Troubleshooting

#### The grid/edit icon is missing

Only parents can edit layouts. Log in as a member with layout-edit permission.

#### My layout doesn't fill the screen / leaves a gap

The live board stretches the box around your widgets to fill the display. If a layout leaves a gap, the widgets usually don't reach the edge of the canvas. Stretch the outermost widgets to the last row or column, or start from a template that fills the whole canvas.

#### Edit-mode toolbar clicks don't respond under browser fullscreen (F11)

In F11 fullscreen the browser keeps the top edge for its own controls, and that can swallow clicks on the top toolbar. Install Prism as a PWA, or just maximize the window, instead of using F11.

#### A community layout applied but looks empty

A community layout only holds widget positions and none of your data. Widgets such as the calendar or meals stay empty until that feature has data, for example once a calendar is connected.
