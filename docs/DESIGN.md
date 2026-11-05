# Prism design guide

How Prism screens should look and behave. The values live in
`src/lib/design/tokens.ts`; `src/styles/globals.css` copies them as CSS, and
`src/lib/design/__tests__/tokens.test.ts` fails if the code, the CSS or the
tables below disagree. Change a value in all three in the same PR.

The bar for every screen: **modern, inviting, advanced, simple.** Advanced
means depth on demand (a tap opens more), never more buttons on the first
screen. When the two pull apart, simple wins.

The reference screen is a 1080p wall display read from across a room. Its root
font size is 20px, so 1rem = 20px in the tables below. A desk (14px root) and a
phone (16px root) scale everything down from there.

## Type

Five sizes, each at least 1.25x the one below, so there is one order to read a
screen in: the clock, then the next thing, then the rows.

| Class | Size on the wall | Weight | Use |
|---|---|---|---|
| `text-caption` | 14px | 500 | Times, counts, "+3 more", widget names |
| `text-body` | 20px | 400 | List rows: a chore, a shopping item, an agenda line |
| `text-title` | 28px | 600 | What a row is about: an event in Now/Next, a person |
| `text-display` | 48px | 600 | The date line; one headline per screen |
| `text-clock` | 100px | 500 | The clock: date above, tabular figures, seconds small and dimmed |
| `text-prose` | 28px | 400 | Sentences on the wall ("Tomorrow Alex has the dentist at 9"); the title's size, looser lines |

- Nothing renders under the text floor: 14px on a touch or kiosk screen, 12px
  at a desk or on a phone, after any zoom (#798). Every class above is floored.
- Widget names are captions, not headings. The content is the heading.
- Two faces: the text face (the theme's font, Inter by default) for everything
  people read, and the display face (`--font-display`) for the clock, the
  temperature and page and sheet titles. A theme that names a numeral face
  (`numeralFont`) sets the display face with it. Weight and size make the
  hierarchy, not colour.
- Times are written as people say them (`formatBareTime`): "9", "5:30", and am
  or pm only before 8 am and from 8 pm.
- Clock digits slide in when they change (about 380ms), never on first paint,
  and not at all under reduced motion.

## Colour

The palette new installs start on is **Paper**: warm neutrals in light and dark, with one accent.

| | Light | Dark |
|---|---|---|
| Page | warm paper, `40 30% 95%` | warm near-black, `30 8% 8%` |
| Card | `40 40% 99%` | `30 7% 12%` |
| Text | warm ink, `30 12% 14%` | `38 22% 92%` |
| Quiet text | `30 8% 36%` | `34 10% 68%` |
| Accent (primary, focus ring) | blue, `214 62% 40%` | `212 80% 72%` |

- **One accent.** Only the accent and the destructive colour are saturated.
  Colour on the wall comes from people's colours, not from the chrome.
- Every text pair reaches 4.5:1 in both modes (checked).
- Light mode is light all the way through: no dark cards inside light chrome,
  and no light-theme icons on dark surfaces.
- Paper is defined but not yet a theme in the picker; #808 registers it and
  makes it the new-install default. Existing themes keep working unchanged.

## Cards

One material everywhere. Only the fill changes.

| Token | Value |
|---|---|
| Corner radius | 16px (`--ds-card-radius`) |
| Padding | 24px (`--ds-card-pad`) |
| Gap between cards | 16px (`--ds-card-gap`) |
| Border | 1px in the border colour, no shadow |
| Over a photo | the card colour at 65% in light, 40% in dark (`--ds-glass-alpha`), with a 24px blur |

- Glass keeps the card's own colour, so a light theme gets light glass and a
  dark theme dark glass. Dark glass is thinner and shows more of the photo:
  its light text holds up over a bright photo, where light glass needs more
  card behind its grey text. A photo is always drawn under a black layer (10%
  light, 40% dark for the bundled scenery; 60% and 70% for the family's own
  photos), and text on glass stays at 4.5:1 over a pure black or a pure white
  photo under that layer (checked).
- Performance Reduced drops the blur and raises the opacity; it never drops
  readability.
- Spacing is on a 4px grid: 4, 8, 12, 16, 24, 32, 48.

### Water: cards and text over a photo (#799)

While a wallpaper shows (`data-wallpaper` on `<html>`), a Glass card is drawn
as water, and the clock and weather corner tiles have no card at all.

- One ink on a photo: warm near-white (247 242 234). No dark or coloured text
  over a photo.
- A water card is a warm near-black tint (24 21 17) with a 10px blur and a faint
  edge. Its thickness (`--ds-water-alpha`, 0.18 to 0.60) is solved per photo so
  the ink reaches 4.8:1 over the brightest part of it (`src/lib/design/water.ts`,
  checked). Until the photo is read it is 0.60.
- The corner tiles sit straight on the photo, over a shade drawn only under the
  two top corners and the bottom, each as dark as that part needs for 4.5:1, up
  to 0.45 (past that the text shadow carries it; a darker shade reads as fog).
- Events on water are a see-through tint of the person's colour, so the photo
  still shows through them.
- Performance Reduced: no blur, and 0.10 more tint, up to 0.70.

## Sheet, buttons and toasts (#908)

- **Sheet**: every dialog draws one sheet: solid (the card colour in light, warm
  near-black in dark), 1.4rem corners, generous padding, a 48px close button, a
  display-face title, actions as pills at the bottom (52px tall in a footer). No
  blur. On a wall (a touch screen 1024px wide or more) it opens on the side that
  was touched: the left or right third on that side, the middle from the bottom.
- **Buttons** are pills: filled with the ink for the one main action, a 1.5px
  outline for a second one, plain text for "Not now". 44px or more on a touch
  screen.
- **Toasts** are one pill with a sentence and a text "Undo" (44px), in the top
  band, centred; on the wall that is between the clock and the weather.

## The dock (#922)

One navigation component. On the wall (a landscape dashboard on a larger
screen) a small "Menu" word sits at the bottom at rest; any touch raises the
dock, and it goes after ten quiet seconds. It is drawn over the page, so
nothing moves when it comes and goes.

- Six pages (Home, Calendar, Chores, Shopping, Meals, Photos by default), More,
  and Sign in or the signed-in person, each with its label; the current page as
  a soft pill. Solid, no blur, one row at 1280x800, every target 44px or more.
- More holds every other page, Settings and Help, and "This screen": Edit
  layout, Reload, the performance badge, Babysitter and Away modes, Screensaver.
- No page can be lost: `dockLayout` puts each visible page on the dock or in
  More, never both (checked).

## Events

A pale tint of the person's colour, a solid 4px bar on the leading edge, and
the text in the normal text colour (#801).

- Tint: the person's colour mixed into the card at 16% in light mode and 26%
  in dark (`--ds-event-tint`), as
  `color-mix(in srgb, <colour> var(--ds-event-tint), hsl(var(--card)))`.
- Never white text on a saturated block. Normal text on every preset member
  colour's tint reaches 4.5:1 in both modes (checked).
- A rounded end means the event starts or ends that day; a chevron means it
  continues. That is meaning, keep it.

## The wall

Rules for a display nobody is touching.

1. **No chrome over the photo.** No solid bars across a wallpaper. Navigation
   hides on the wall and comes back on the first touch.
2. **Labelled or hidden.** An icon-only rail is not allowed on the wall. Show
   labels, or hide the rail until touched.
3. **Nothing clipped.** A list that does not fit ends in "+3 more", never in a
   half-cut row or a cut title.
4. **Read-only looks read-only.** Signed out, there are no pencils, trash cans
   or edit handles on rows. Ticking a chore or a list item is the exception.
5. **One headline.** Each screen has one largest thing (the clock or the next
   event). Everything else steps down from it.
6. **Hide what is empty.** An empty widget hides on the wall, or says one
   short sentence; it does not show an empty box with an Add button.
7. **Idle screen: straight on the photo.** When the wall goes idle, the glass
   cards that stay (the clock and weather) turn fully clear. Their text turns
   light and carries a soft dark shadow (`--ds-idle-text-shadow`); small
   details such as the sun and moon times keep a small backing.

## Touch

- Every target is at least 44px by 44px (`--ds-target-min`), including the
  space around a small icon.
- Everyday jobs (tick a chore, tick a list item) take one tap and offer undo,
  rather than asking for a PIN first.
- Tap an event to open it; "+" on a widget adds to it.

## Motion

150ms for small feedback, 250ms for panels, 600ms for page and photo changes.
Performance Reduced and `prefers-reduced-motion` turn all of it off; nothing
may depend on an animation to make sense.

## What the test checks

`src/lib/design/__tests__/tokens.test.ts`:

- the type scale starts at the floor and steps up by 1.25x or more;
- each `text-*` role and `--ds-*` value in `globals.css` matches `tokens.ts`;
- Paper's text pairs reach 4.5:1, it has one accent, and glass and event tints
  stay readable;
- this file lists each type size and the card numbers.
