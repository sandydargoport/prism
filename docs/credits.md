# Credits

Prism is built on work other people gave away. This page credits it, and for
the emoji artwork it is also a licence obligation rather than a courtesy.

The full licence texts ship with Prism: `NOTICE` and `third-party/` are inside
the container image as well as the repository.

## Emoji artwork — Twemoji

Emoji are drawn with the **Twemoji** graphics rather than left to the device,
so a birthday cake looks the same on the kitchen display, a phone and a cheap
kiosk stick — many of which have no colour emoji font at all.

- Copyright © 2014–2021 Twitter, Inc and other contributors
- Copyright © 2022–present Jason Sofonia & Justine De Caires
- Graphics licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Code licensed under the MIT License
- Source: <https://github.com/discord/twemoji>

The graphics are used unmodified. CC-BY requires attribution from anyone
redistributing them, which includes anyone running or forking Prism.

## Typeface — Inter

- Copyright © 2016 The Inter Project Authors
- [SIL Open Font License 1.1](https://openfontlicense.org/)
- Source: <https://github.com/rsms/inter>

Self-hosted from your own instance. Prism never asks a third-party font host
for it, so a display on a private network renders the same as one online.

## Emoji font — Noto Color Emoji

- Copyright 2021 Google Inc.
- [SIL Open Font License 1.1](https://openfontlicense.org/)
- Source: <https://github.com/fontsource/font-files>

A fallback for clients with no emoji font of their own. Split by unicode-range
so a display downloads only the ranges it actually draws.

## Prism itself

Prism is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).
That covers Prism's own code; the assets above keep their own, more permissive
licences, and bundling them places no condition on Prism.
