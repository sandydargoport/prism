# Themes

Prism ships five palettes. Choose one under *Settings → Appearance → Palette*.

| | |
|---|---|
| **Prism** | The original. Cool blues on a clean surface. |
| **Clay** | Warm earth tones. Easier on the eyes in a bright kitchen. |
| **Harvest** | Late autumn. Amber, bark and a low sun. |
| **Snow Day** | Cold light and pale blue. Quiet, and easy to read. |
| **Arcade** | Sixteen-bit console. Saturated primaries on near-black. |

## What is per-screen and what is not

**The palette is for the whole house.** Change it on a phone and the kitchen
display changes too. It is a decision about how your home looks, and a house
where every screen is a different colour is a house where something looks
broken.

**Light and dark are per-screen.** That is a decision about the room a
particular screen is in — a hallway display at night and a tablet in a bright
kitchen want different answers, and both are right at the same time.

The same split applies to the screensaver timeout and font scale, which are
also per-screen.

## Readability

Every palette is checked before it can ship. Contrast is measured on eight
text pairs in both light and dark; anything that falls below a readable ratio
is rejected rather than shipped and apologised for.

This is stricter than it sounds for a reason. Prism is read from across a
room, often by someone who is not wearing their glasses, sometimes by a child.
A palette that looks striking on a laptop and turns the calendar into grey on
grey is worse than no palette at all, because the person looking at it usually
cannot tell whether the fault is the theme or the screen.

## If a palette makes Prism unreadable

Add `?theme=default` to the address:

```
http://your-prism-address/?theme=default
```

That resets to the default palette and saves the change, so the screen comes
back the next time it loads too.

It exists because a wall display has no keyboard, and a palette with a broken
background and text pairing can make the Settings page itself unreadable —
which would otherwise mean opening a terminal to recover a colour choice.

## Sharing a theme

A theme is nothing but colour values, so it can be passed between households.
Two ways, and they differ in what happens to your work:

- **Through the gallery** — anyone can install it, and it stays yours.
- **As a contribution** — it ships with Prism for everyone, which needs the
  Contributor License Agreement, because Prism then distributes it.

Neither is better. `community/themes/README.md` has the detail, including what
is checked and what is not allowed.

The submission side is not finished yet.

## What a theme cannot change

Themes set surface and text colours. They do not currently change:

- family member colours, which are per-person and set on each member
- the fixed colours used for chore status and task priority
- fonts, spacing or corner radius

Family member colours are deliberately excluded: they identify a person across
the whole app, and a palette should not be able to reassign who is green.
