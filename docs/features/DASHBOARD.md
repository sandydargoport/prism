# Dashboard & Layouts

The dashboard is the wall-display face of Prism: a full-screen board of live widgets (calendar, weather, clock, meals, tasks, chores, photos, and more) arranged however you like. You design it with a drag-and-resize layout editor, start from one of six built-in templates, borrow a design from the community gallery, and keep separate boards for separate rooms.

Everything on this page is edited in **dashboard edit mode** (parent only). It is a desktop/large-screen tool: the editor is hidden on phones, which get a simplified single-column dashboard instead (see [Mobile (PWA)](MOBILE.md)).

---

## Entering the editor

Tap the **grid icon** (four squares) in the dashboard header to enter edit mode. Only members with layout-edit permission (parents) see it.

Edit mode swaps the live board for an editable grid and reveals two toolbars: a slim vertical toolbar on the left (Widgets, Templates, Community, Mini-map) and a right-hand toolbar (Preview, orientation, Screensaver, Save, and the **More** menu). Exit by saving or leaving edit mode.

---

## The layout grid

Prism lays widgets out on a fixed **design canvas**, not on your literal pixels, so one design looks right on many screens:

- **Landscape** canvas: **48 columns × 27 rows** (16:9).
- **Portrait** canvas: **36 columns × 64 rows** (9:16).

On the live dashboard the content bounding box is stretched to fill the actual screen, so a layout that tiles the whole canvas fills the display edge-to-edge regardless of its exact resolution.

### Placing and sizing widgets

- **Drag** a widget to reposition it on the grid.
- **Resize** by dragging the corner handles.
- Open the **Widgets** button to show/hide each widget and to type exact `x / y / w / h` coordinates when you want pixel-precise placement.

Available widgets: **Clock, Weather, Calendar, Tasks, Chores, Shopping, Meals, Messages, Photos, Points/Goals, Birthdays, Wishes, and Bus Tracker.**

### Widget properties

Click a widget to select it, then use the **properties toolbar** to style it individually:

- Background color (including a **frosted-glass** option used by the Ambient templates)
- Opacity
- Outline
- Text color
- Text size

---

## Built-in templates

The **Templates** button loads a pre-designed arrangement as a starting point you then rearrange. There are **six** templates, and each ships in **both landscape and portrait** versions (the picker offers the orientation matching your current canvas). The screensaver has its own matching set (see below).

The templates follow a deliberate composition rubric: one **hero** widget per board (usually the calendar; on photo-forward boards the wallpaper itself is the hero), supporting widgets sized to their natural shape, grouped into two or three balanced zones rather than an even 4-up grid.

| Template | What it's for | Widgets |
| --- | --- | --- |
| **Family Central** | The everyday board. | Calendar hero, a tall upcoming-events / birthdays rail, and a weather + clock strip. |
| **Calendar Focus** | When the schedule is everything. | A full-height calendar hero with a slim weather + clock rail. |
| **Command Center** | Everything at a glance. | Calendar hero plus weather, clock, messages, and task + chore list columns. |
| **Meal Planner** | Kitchen board. | Meals hero, a tall shopping-list column, and a weather + clock corner. |
| **School Mornings** | Out-the-door board. | Calendar hero, a bus departure countdown, weather, homework tasks, and the lunch menu. |
| **Ambient** | Photo-forward. | Intentionally sparse: a couple of frosted-glass clock/weather accents floating over open space so a photo **wallpaper** shows through as the hero. Pair it with a photo wallpaper. |

Most templates tile the canvas exactly; **Ambient** is the intentional exception, leaving the middle open for the wallpaper.

> There is also an internal weather-forward **Default** fallback layout applied to a brand-new empty dashboard (a fresh install hasn't connected a calendar yet, so it deliberately omits the calendar hero). It isn't shown in the template picker.

---

## Community gallery

Click **Community** in the editor toolbar to browse dashboard layouts shared by other Prism users. The gallery loads a community index and shows each layout as a card with a live thumbnail preview, its name, description, author, widget count, and orientation.

- **Search**: type in the search box and press **Enter** to match layouts by name/description; the field has a clear (×) button.
- **Filter by orientation**: tap **▭ Landscape** or **▯ Portrait** to show only matching layouts; tap again to clear. The filter defaults to the orientation of the dashboard you're editing. (Layouts stretch to fill whatever screen they're shown on, so the exact resolution doesn't matter: orientation is what counts, since a portrait layout letterboxes on a landscape screen and vice-versa.)
- **Preview**: every card renders a miniature board floating on a neutral "photo field", auto-oriented so portrait boards don't overflow, with an orientation badge.
- **Apply layout**: click it to drop that design onto your dashboard.
- **Clear filters**: shown when a search/orientation filter returns nothing.

The gallery has a separate **dashboard** and **screensaver** mode, so screensaver layouts are browsed the same way.

### Sharing your layout with the community

Made a board worth sharing? Open the **More** menu and click **Share**, fill in a name, description, author, and orientation, then submit. Prism opens a pre-filled submission for you (this works from any instance, including hosted ones), and once it's approved your layout appears in everyone's Community gallery.

### Export & Import

- **Export** (More → Export): copy your current layout as JSON to hand to someone directly.
- **Import** (More → Import): paste a layout JSON to load someone else's design.

---

## Mini-map & validation

Click **Mini-map** in the left toolbar to see a miniature map of your whole layout. It shows widget positions and flags issues like overlapping or undersized widgets. Click anywhere on the mini-map to scroll the grid to that area.

Alongside it, a **device preview gallery** shows how your single design renders on each common screen size, so you can confirm one layout works across your displays without maintaining a separate design per resolution.

---

## Preview mode

Click **Preview** in the right toolbar (or press **Ctrl+Shift+M**) to temporarily hide the editor chrome and see the board as it will actually appear; click **Exit Preview** to return. Use the **Show Nav / Hide Nav** toggle to check how it looks with and without the navigation sidebar. Useful for fine-tuning layouts on dedicated wall displays.

For a permanently clean look, enable **Auto-Hide Navigation** in *Settings → Appearance*: the nav and toolbar hide after a period of inactivity and reappear on click or keyboard input.

---

## Screensaver layout

Each dashboard has its **own** screensaver layout. In edit mode, click the **Screensaver** button to switch to editing the screensaver widget arrangement (the Templates and Community pickers switch to their screensaver sets too).

The screensaver activates after a configurable idle period. Set it under *Settings → Appearance → Timers & Auto-Activation (Screensaver → Activate after)*; the timeout options are **30s / 1m / 2m / 10m / 1h / Never**, defaulting to **2m**. It shows a photo slideshow with your chosen widgets overlaid. The screensaver templates keep the calendar, or tonight's meals, as the hero, with small clock, weather, and message accents floating over one clean photo region so the wallpaper stays the star.

See [Display Modes](DISPLAY-MODES.md) for more on the screensaver and Away Mode.

---

## Multiple dashboards

Create separate dashboards for different rooms or displays. Click the dashboard-name dropdown in the editor toolbar to switch between dashboards or create new ones.

- The **default** dashboard lives at **`/`**. Make any dashboard the default via **More → Set as Default**.
- Named dashboards get URLs like **`/d/kitchen`** or **`/d/living-room`**.
- Each dashboard has an **independent** widget layout, screensaver layout, and orientation.
- Bookmark a dashboard URL on a dedicated device for instant access.

### Saving

- **Save** overwrites the current dashboard's layout.
- The dropdown arrow next to Save offers **Save As**, which creates a named copy (a new dashboard).
- **More → Reset** reverts unsaved edits back to the last saved layout.

---

## Orientation

Toggle between **Landscape** and **Portrait** with the orientation button in the editor toolbar. This flips the design canvas between the 48×27 landscape frame and the 36×64 portrait frame, so you can lay out each orientation independently for however that display is mounted.

---

## Troubleshooting

### The grid/edit icon is missing

Layout editing is parent-only. Log in as a member with layout-edit permission.

### My layout doesn't fill the screen / leaves a gap

The live board stretches the content bounding box to fill the display. If a template leaves a gap, it usually means the widgets don't reach the canvas edge: extend the outermost widgets to the last row/column, or start from a template that tiles the full canvas.

### Edit-mode toolbar clicks don't respond under browser fullscreen (F11)

Browser F11 reserves the top edge for its own chrome, which can eat top-toolbar clicks. Install Prism as a PWA (or just maximize the window) instead of using F11.

### A community layout applied but looks empty

Community layouts only carry widget positions, not your data. Widgets like calendar or meals render empty until the underlying feature has data (e.g. a connected calendar).
