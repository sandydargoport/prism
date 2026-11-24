# The screen and dashboard model

This page is the target every Screens redesign 2 change builds against (#1356). It is frozen: a later change that needs a different model edits this page first, in its own PR. The examples use a screen named Hallway and a dashboard named Main.

**The screen owns time. The dashboard owns content.** A screen decides what it shows when, how it idles by day and at night, how much darker it goes at night, light or dark, and whether photos sit behind the dashboard. A dashboard is a page of widgets with no sense of time.

## Objects and owners

| Object | What it is | Owns |
|---|---|---|
| **Household** | The whole house | Palette, seasonal theme, photo captions and On this day, night sky aurora, units, language, location and time zone, Away and Sitter. The starting values a new screen copies once, and the values an unnamed device uses: which dashboard, light or dark, the idle and night look. |
| **Screen** | A named device, such as Hallway | Its name. What it normally shows and its switches. When it goes idle, what it shows when idle by day and at night, how much darker at night. Light or dark. Photos behind the dashboard. Hardware: orientation, performance, keyboard, auto-hide, sign-out, notices. |
| **Dashboard** | A page of widgets, such as Main | Its name, its widgets and their arrangement, text size, which widgets stay when idle, its photo frame arrangement. |
| **Widget** | One tile on a dashboard | Position, its own settings, Stays when idle, Hide when empty, Hide first on a small screen, fill, outline, text. |

**A phone is not a screen.** Below 768px wide (`MOBILE_BREAKPOINT` in `src/lib/hooks/useIsMobile.ts`) a dashboard is drawn as a phone page, it never idles, and the editor does not offer it as a size. A phone owns two things, both kept in that phone's browser: which cards it shows and their order. Everything else a phone edits belongs to a screen or a dashboard, and the UI says which.

Glance is the built-in dashboard (`layouts.view = 'today'`). It has parts, shown or hidden, and no positioned cards.

## Attributes

How to read the storage columns:

- **screen key `k`**: one of `SCREEN_SETTING_KEYS` in `src/lib/displays/screenSettings.ts`. The browser keeps it under `k` in localStorage; on a named screen the same value is also kept in `displays.settings` and synced.
- **browser `k`**: localStorage only, in that one browser.
- **row `k`**: a household row in the `settings` table, `src/lib/db/schema.ts`.
- **`table.column`**: a column in `src/lib/db/schema.ts`. Widget fields live inside `layouts.widgets`, typed as `WidgetConfig` in `src/lib/hooks/useLayouts.ts`.
- **Planned** marks storage or a control that does not exist yet. The issue that adds it is named.

Editor directions start at the editor of a screen, for example Editor > Screen > When idle. The header holds the Editing drop-down and the header menu.

### Household

| Attribute | Stored today | Stored after | Edited after |
|---|---|---|---|
| Palette | row `theme` (`paletteId`, `installed`) | unchanged | Settings > Appearance |
| Theme row `mode` | row `theme.mode`, written and never read | the field stays in old rows; code stops writing it (#1343) | none |
| New screens start light or dark | row `defaultThemeMode`, no control | unchanged | Planned: Settings > Appearance > New screens start as (#1340) |
| Seasonal theme, starting value | none; each browser has its own (see Screen) | Planned: a household row | Settings > Appearance |
| Night sky aurora | row `nightSkyAurora` | unchanged | Settings > Appearance |
| Units | row `weather` (`units`) | unchanged | Settings > Appearance |
| Language | row `locale` | unchanged | Settings > Appearance |
| Location | row `location` | unchanged | Settings > General |
| Time zone | row `timezone` | unchanged | Settings > General |
| Photo captions: when and where taken | rows `photoCaptionDate`, `photoCaptionPlace` | unchanged | Settings > Photos (today behind the wallpaper switch in Appearance, #1351) |
| On this day | row `photoOnThisDay` | unchanged | Settings > Photos |
| Bundled scenery while there are no photos | row `wallpaperScenery`, set by setup, no control | unchanged | none |
| Household on-screen keyboard | row `input.virtualKeyboardEnabled` | unchanged | Settings > Input |
| Away | row `awayMode` | unchanged | Settings > Screens; More > Away |
| Away turns on after | row `awayModeAutoAfterHours` | unchanged | Settings > Screens |
| Sitter | row `babysitterMode` | unchanged | More > Babysitter |
| New and unnamed screens show | `layouts.is_default` on one dashboard | unchanged | Settings > Screens > New and unnamed screens show (today Make the default, in the editor) |
| Starting idle and night look | the default dashboard's `layouts.idle_background` | Planned: one household row, seeded by migration 0057 (#1345) | Settings > Screens > New and unnamed screens show |

### Screen

| Attribute | Stored today | Stored after | Edited after |
|---|---|---|---|
| Name | `displays.name` | unchanged | Editor > Screen > This screen (saves on Done) |
| Normally (what it shows) | `displays.dashboard_id`, null for the household's dashboard | unchanged | Editor > Screen > Shows > Normally |
| Switches (set times, bus time) | `displays.switches` | unchanged | Editor > Screen > Shows |
| Stays awake, per switch | `staysAwake` on each entry of `displays.switches`; absent is on for bus time, off for set times | unchanged | Editor > Screen > Shows, in the switch's row |
| Idle after | screen key `prism-screensaver-timeout` | unchanged | Editor > Screen > When idle |
| Idle look by day | `layouts.idle_background` of the dashboard that is up | Planned: screen key `prism-screen-day` (#1345) | Editor > Screen > When idle > By day |
| Idle look at night | `layouts.idle_background` of the dashboard that is up | Planned: screen key `prism-screen-day` (#1345) | Editor > Screen > When idle > At night |
| When night is (dusk to dawn with offsets, or set times) | `layouts.idle_background` (`switch`) | Planned: screen key `prism-screen-day` (#1345) | Editor > Screen > When idle > Advanced |
| Darker at night | screen key `prism-screensaver-dim` | Planned: inside screen key `prism-screen-day` (#1345) | Editor > Screen > When idle > At night |
| Transition effect | screen key `prism-screensaver-motion` | unchanged | Editor > Screen > When idle > Advanced |
| Change every | screen key `prism-screensaver-motion-interval` | unchanged | Editor > Screen > When idle > Advanced |
| Show at least, Show at most | screen keys `prism-screensaver-min-widgets`, `prism-screensaver-max-widgets` | unchanged | Editor > Screen > When idle > Advanced |
| Transition length | screen key `prism-screensaver-speed` | unchanged | Editor > Screen > When idle > Advanced, only for the effect that uses it |
| Carbonation, waterline, wobble | screen keys `prism-screensaver-carbonation`, `prism-screensaver-water-clear`, `prism-screensaver-wobble` | unchanged | Editor > Screen > When idle > Advanced, only for the effect that uses them |
| Drift | screen key `prism-screensaver-drift` | unchanged | Editor > Screen > When idle > Advanced |
| Change photo every (photo frame) | screen key `prism-screensaver-interval` | unchanged | Editor > Screen > When idle > Advanced |
| Outlines on the photo frame | screen key `prism-screensaver-outlines` | unchanged | Editor > Screen > When idle > Advanced |
| Motion carry-over flag | screen key `prism-screensaver-motion-v2` | removed after a one-time rewrite | none |
| Settings shortcut on the photo frame | screen key `prism-screensaver-shortcut` | removed with the motion modal | none |
| Saved photo frame presets | browser `prism-screensaver-presets` | unchanged for the release | Editor > Screen > When idle > Advanced |
| Light or dark | browser `prism-theme` | Planned: screen key `prism-theme`, a concrete value on a named screen (#1340) | Editor > Screen > This screen |
| Seasonal theme | browser `prism-seasonal-theme` | Planned: screen key `prism-seasonal-theme` (#1340) | Editor > Screen > Advanced |
| Photos behind the dashboard | browser `prism-wallpaper-enabled` | Planned: screen key `prism-wallpaper-enabled`, locked on for Glance (#1340) | Editor > Screen > This screen |
| Rotate photos behind the dashboard | browser `prism-wallpaper-interval` | Planned: screen key `prism-wallpaper-interval` (#1340) | Editor > Screen > This screen |
| Match photos to orientation | browser `prism-wallpaper-auto-orientation` | Planned: screen key `prism-wallpaper-auto-orientation` | Editor > Screen > Advanced |
| Pinned photo behind the dashboard, pinned idle photo | browser `prism-pinned-wallpaper`, `prism-pinned-screensaver` | Planned: screen keys of the same names (#1340) | Settings > Photos, with the screen named |
| Time zone shown | browser `prism:display-timezone-mode` | Planned: screen key `prism:display-timezone-mode` (#1340) | Editor > Screen > Advanced |
| Orientation | screen key `prism-orientation-override` | unchanged | Editor > Screen > Advanced |
| Performance | screen key `prism-perf-mode` | unchanged | Editor > Screen > Advanced |
| On-screen keyboard on this screen | screen key `prism:keyboard-on-this-device` | unchanged | Editor > Screen > Advanced |
| Auto-hide navigation | screen key `prism:auto-hide-ui` | unchanged | Editor > Screen > Advanced |
| Sign out after | screen key `prism-idle-logout-minutes` | unchanged | Editor > Screen > Advanced |
| Notices | screen key `prism-screen-attention` | unchanged | Editor > Screen > Advanced |
| Safe zones | screen key `prism:screen-safe-zones` | unchanged; the photo frame fits itself to them | none |
| Reported size | `displays.screen_width`, `displays.screen_height` | unchanged | none; the screen reports it |
| Timeline (retired) | `displays.timeline_id`, table `timelines`, both unread | kept unread, dropped after the release | none |

### Dashboard

| Attribute | Stored today | Stored after | Edited after |
|---|---|---|---|
| Name | `layouts.name` | unchanged | Header menu > Rename |
| Address | `layouts.slug` | unchanged | none; follows the name |
| How it is drawn (grid or Glance) | `layouts.view` | unchanged; the type loses `'calendar'` (#1343) | none; chosen when the dashboard is made |
| Widgets and their arrangement | `layouts.widgets` | unchanged | Editor > Widgets |
| Text size (13 steps, 75% to 150%) | `layouts.font_scale` | unchanged | Editor > Look (today Settings > Text Size, #1351) |
| Photo frame arrangement | `layouts.screensaver_widgets` | unchanged; the running photo frame reads it from here (#1346) | Editor > Screen > When idle > Arrange the photo frame |
| Idle and night look | `layouts.idle_background` | kept unread after 0057, dropped after the release (#1345) | none; it moves to the screen |
| Screen shape | `layouts.orientation` | the column stays; its control goes | none |
| Old routing id, old idle mode | `layouts.display_id`, `layouts.screensaver_mode`, both unread | kept unread, dropped after the release | none |
| Photo frame arrangement, old per-browser copy | browser `prism-screensaver-layout` | read once at upgrade, then never at runtime (#1346) | none |

### Widget

| Attribute | Stored today | Stored after | Edited after |
|---|---|---|---|
| Position and size | `WidgetConfig` `x`, `y`, `w`, `h` | unchanged | Editor > Widgets, on the canvas |
| Shown, or a Glance part shown | `WidgetConfig.visible` | unchanged | Editor > Widgets, the widget list |
| Its own settings | `WidgetConfig.settings` | unchanged | Editor > Widgets > the selected widget |
| Align | `WidgetConfig.settings.align` | unchanged | Editor > Widgets > the selected widget |
| Old per-browser align | browser `prism-widget-alignments` | removed (#1343) | none |
| Fill | `WidgetConfig.backgroundColor`, `backgroundOpacity` | unchanged | Editor > Widgets > the selected widget; Editor > Look > Apply to all widgets (#1339) |
| Outline | `WidgetConfig.outlineColor`, `outlineOpacity` | unchanged | Editor > Widgets > the selected widget; Editor > Look > Apply to all widgets (#1339) |
| Text colour and size | `WidgetConfig.textColor`, `textScale` | unchanged | Editor > Widgets > the selected widget; Editor > Look > Apply to all widgets (#1339) |
| Text opacity | `WidgetConfig.textOpacity`, applied with no control | removed (#1343) | none |
| Grid lines and cells | `WidgetConfig.gridLineOpacity`, `cellBackgroundColor`, `cellBackgroundOpacity` | unchanged | Editor > Widgets > the selected widget |
| Stays when idle | `WidgetConfig.showWhenIdle` | unchanged | Editor > Widgets > the selected widget, as a switch |
| Hide when empty | `WidgetConfig.hideWhenEmpty` | unchanged | Editor > Widgets > the selected widget |
| Hide first on a small screen | `WidgetConfig.hideOnSmallScreen` | unchanged | Editor > Widgets > the selected widget |

### Phone and browser

| Attribute | Owner | Stored today | Stored after | Edited after |
|---|---|---|---|---|
| Cards shown | Phone | browser `prism-mobile-hidden-cards` | unchanged | More > This phone > Cards |
| Card order | Phone | browser `prism-mobile-card-order` | unchanged | More > This phone > Reorder |
| Cards as rows or tiles | Phone | browser `prism-mobile-layout` | unchanged | More > This phone > Cards |
| Photo download size | Browser | browser `prism-target-resolution` | unchanged | Settings > Photos, labelled "this browser" |
| Display context filters | Browser | browser `prism-display-contexts`, written and never read | removed (#1343) | none |

## Glance, per tab

| Tab | What Glance gets |
|---|---|
| Widgets | Its parts list, shown or hidden, with no positions. |
| Look | Text size only. Fill and Outline are hidden, with the line "Glance has no cards." |
| Screen > When idle | "Glance, quieter" (the photo stays, the parts fade) or Night sky. Photo frame is offered and labelled "its own widgets". |
| Photos behind the dashboard | Shown as on and locked, with the reason "Glance always draws the photo". |

## Words

Use the words on the left. The words on the right are retired from the UI, Help and docs. The label table (#1337) is the copy a check reads; this list is for people.

| Use | Retire |
|---|---|
| Screen, Dashboard, Household | "This device", "display" |
| In use, Idle; Day, Night | Resting, screensaver, calm, Idle screen, asleep, "nobody is using it" |
| "When idle", with the wait in the same row: "Idle after 2 min" | "Rest after", "Activate after", "Start after" |
| The dashboard, quieter; A photo frame; The night sky | "This dashboard" or "Photos" as an idle choice |
| "Darker at night: 50%" | "Dim this dashboard", "How dark", "Dim when idle" |
| Normally (the row that says what the screen shows) | "Base dashboard" |
| Editing (which dashboard the canvas has open) | an unlabelled dashboard list |
| "New and unnamed screens show" | "Make the default" |
| Stays, Fades | "Stays when idle" as a badge with no switch |
| This phone (the group in a phone's More) | "This screen" as a group on a phone; "Dashboard options" |
| Edit a screen (a phone's way into the editor) | "Edit layout" on a phone |

## What a screen says about itself

Each screen describes its day in one sentence, built by the same function the wall runs. The Screen tab shows it at the top and Settings > Screens uses it as the row summary:

> Hallway shows Main. On school days it shows Bus board around bus time and stays awake for it. Idle for 2 minutes, it becomes a photo frame. At night the photo frame is 50% darker.

When something will not happen, the sentence says so, for example "Never idles, so it has no night look."

The precedence sentence, shown in Help and under the Shows rows:

> Someone using the screen sees the dashboard for that time. Idle, it shows its idle look, and at night its night look. Away covers the screen but keeps the night's darkness and Screen off. Sitter covers the screen and is never turned off.

## Defaults for a new install

- The screen shows Glance.
- Idle after 2 minutes, it shows Glance, quieter.
- Night runs dusk to dawn, looks the same as by day, and is 50% darker. A new screen gets this level written when it is created; the code default for a missing level stays at not darker, so existing screens and unnamed browsers keep what they have.
- Light or dark comes from the household starting value.
- There are no switches. Bus time is offered once a bus route exists.

## Rules that hold everywhere

- **The screen owns time. The dashboard owns content.** A dashboard never holds a clock time or a night rule.
- **A switch changes what the screen shows. Night changes how it idles.** Both sit on the Screen tab, and the UI says in one line that they are different kinds of thing.
- **Household values are starting points.** A new screen copies them once and then holds its own. Nothing is shared and nothing is picked from a list. An unnamed device uses the household values until it sets its own.
- **One function answers "what is on this screen now".** The wall, the editor's canvas, the day strip and the screen's sentence all call it, and a test holds them to it (#1344).
- **From a phone you edit a screen, never the phone.** The editor on a phone draws the wall at the wall's size. The phone's own cards are under More > This phone.
- **One button, one job.** On a phone the round button means Add. The bar goes to pages. More holds everything else, and nothing appears in two of them.
- **One save rule.** Everything in the editor waits for Done (#1341).
- **One precedence sentence**, the one above, in Help and under the rows.
