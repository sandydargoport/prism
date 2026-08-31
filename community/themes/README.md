# Community themes

A theme is a set of colours. Nineteen values for light mode, nineteen for dark,
a name and a short description. No CSS, no fonts, no images — a theme cannot
contain anything but colour values, deliberately.

## Two ways to share one

Pick whichever suits you. They differ in who owns the theme afterwards, and it
is worth understanding the difference before choosing.

### The gallery — your theme stays yours

Open a submission from inside Prism (*Settings → Appearance → Palette → Share*)
and it becomes available for anyone to install. You keep the rights to it. It
is licensed to this project for distribution in the gallery and nothing more.

Choose this if you want people to be able to use your theme and you would
rather keep it.

### A pull request under the CLA — it ships with Prism

If you would like your theme to be one of the palettes everyone gets in the
box, open a pull request adding it to `src/lib/themes/appThemes.ts` and sign
the Contributor License Agreement.

The CLA is required for this route and not for the other, because a built-in
theme becomes part of what Prism itself distributes. That means the project
needs the right to keep shipping it, including if Prism is ever hosted
commercially or moves to a different licence.

Choose this if you would rather your theme just *be* one of Prism's looks.

Neither route is better. The first keeps your work yours; the second puts it
in front of everyone.

## What is checked

Automatically, on submission:

- **Every colour is a bare HSL triple.** Anything else is rejected. This is
  what makes a theme unable to carry CSS.
- **Text has to be readable.** Contrast is measured on eight foreground and
  background pairs in both modes. Below 3:1 is rejected. Between 3:1 and 4.5:1
  is accepted but shown on the gallery card, so whoever installs it can judge.
  Prism is read from across a room, often by someone without their glasses.
- **Name, description, tags** are length-limited and must be plain text.

By a person, before it merges:

Every submission becomes a pull request that a maintainer reviews. Themes are
declined if they are profane, bigoted, politically partisan, or built to divide
people. This is a display in a family kitchen, and it is read by children.

Themes named after a franchise, or reproducing a recognisable brand's look, are
also declined — not because a palette can be owned, but because the name is
what attracts a complaint. Name it after a season, a feeling, or a period.
"Arcade" is fine; a console's name is not.

If a rights holder ever asks for something to be removed, it is removed. No
argument, no delay.

## Contrast, in practice

The bar is deliberately not WCAG AA everywhere. Hard-failing every pair below
4.5:1 would reject a lot of themes that are genuinely pleasant to look at, and
the first thing it would reject is the work of the people most likely to
contribute. So the rule is: below 3:1 nobody can read it and it does not ship;
between 3:1 and 4.5:1 it ships with the warning visible.
