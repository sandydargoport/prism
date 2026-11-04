# Prism design guide

How Prism 2.0 screens should look and behave. The values live in
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
| `text-clock` | 100px | 300 | The clock, with tabular figures |

- Nothing renders under the text floor: 14px on a touch or kiosk screen, 12px
  at a desk or on a phone, after any zoom (#798). Every class above is floored.
- Widget names are captions, not headings. The content is the heading.
- One family per screen (the theme's font). Weight and size make the hierarchy,
  not colour.

## Colour

The 2.0 palette is **Paper**: warm neutrals in light and dark, with one accent.

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
| Over a photo | the card colour at 65% (`--ds-glass-alpha`) with a 24px blur |

- Glass keeps the card's own colour, so a light theme gets light glass and a
  dark theme dark glass. A photo is always drawn under a black layer (10%
  light, 40% dark for the bundled scenery; 60% and 70% for the family's own
  photos), and text on glass stays at 4.5:1 over a pure black or a pure white
  photo under that layer (checked).
- Performance Reduced drops the blur and raises the opacity; it never drops
  readability.
- Spacing is on a 4px grid: 4, 8, 12, 16, 24, 32, 48.

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
