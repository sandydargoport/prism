# Looks and colours

Choose how Prism looks (a photo behind glass, the same kept dark, or plain paper), then pick a colour palette.

There are seven palettes, and you choose one under *Settings → Appearance → Palette*.

| | |
|---|---|
| **Prism** | The original palette, with cool blues on a clean surface. |
| **Paper** | Warm paper neutrals with one blue accent, so the colour comes from the family. New installs start on it. |
| **Clay** | Warm earth tones that are easier on the eyes in a bright kitchen. |
| **Harvest** | Late autumn: amber, bark and a low sun. |
| **Snow Day** | Cold light and pale blue, quiet and easy to read. |
| **Arcade** | A sixteen-bit console look, with saturated primaries on near-black. |
| **Notice Board** | Near-white, flat and tightly packed, so the events supply the colour. |

## What is per-screen and what is not

The palette is set for the whole house. If you change it on a phone, the kitchen display changes too. It decides how your home looks, and when every screen is a different colour the house looks like something is broken.

Light and dark are set per screen, because that choice depends on the room the screen is in. A hallway display at night and a tablet in a bright kitchen need different answers, and both are right at the same time. A screen that has never been set follows its system setting, or uses dark on an install that picked the **Night** look during setup.

The screensaver timeout and text size are per screen as well.

## Readability

Every palette is checked before it can ship. Contrast is measured on eight pairs of text and background colours, in both light and dark, and any palette with a pair below a readable ratio is turned away before release.

The check is strict for a reason. People read Prism from across a room, often without their glasses on, and sometimes they are children. A palette that looks striking on a laptop but turns the calendar into grey on grey is worse than no palette, because the person looking at it usually can't tell whether the theme or the screen is at fault.

## If a palette makes Prism unreadable

Add `?theme=default` to the address:

```
http://your-prism-address/?theme=default
```

That switches back to the default palette and saves the change, so the screen still has it the next time it loads.

This is there because a wall display has no keyboard, and a palette with a bad pairing of background and text can make the Settings page itself unreadable. Without it, you would need to open a terminal to undo a colour choice.

## Sharing a theme

A theme is only colour values, so households can pass themes to each other. There are three ways, and each treats your work differently:

- **As a file**: *Settings → Display → Palette → Share → Download file* saves the palette you are using as a `.json` file. Send it any way you like, and the other household installs it with **Import**, next to Browse. You don't need a GitHub account, and only the people you send it to get the file.
- **Through the gallery**: anyone can install it, and it stays yours. You need a GitHub account to submit it.
- **As a contribution**: it ships with Prism for everyone. That needs the Contributor License Agreement, because Prism then distributes it.

The gallery and a contribution are equally good choices. `community/themes/README.md` has the details, including what gets checked and what isn't allowed.

An imported file goes through the same checks as a gallery theme. Prism refuses it if its name matches a built-in palette or a theme you already have, so an import never replaces anything. Remove the old theme first, or rename the theme in the file.

## Beyond colour

A palette also sets three shape values, which keep the themes from looking like tints of one another:

- **Corner rounding** runs from square to soft. Arcade is square, and Snow Day is the roundest.
- **Density** is how much space sits inside and between cards. Snow Day is airy and Arcade is tight.
- **Border weight** runs from none to heavy. Snow Day has no borders at all and separates things with space, while Arcade outlines everything.

All three have limits. Past a certain point they look like a broken layout, and whoever installed the theme can't tell which it is.

## What a theme cannot change

Themes set the colours of surfaces and text. For now they don't change:

- family member colours, which belong to each person and are set on each member
- the fixed colours for chore status and task priority
- fonts, spacing or corner radius

Family member colours are left out on purpose. They identify a person everywhere in the app, and a palette shouldn't be able to change who is green.
