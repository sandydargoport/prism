# Archived: fixed-scale "safe-zone" layout preview

**Archived:** 2026-08-02 · **Snapshot of commit:** `ee1c27e`

## What this was

The dashboard layout editor originally previewed a design against a set of
configurable **screen "safe zones"** (target resolutions like 1080p, iPad, etc.).
Because the live dashboard used **square cells at a fixed scale**, a layout could
fit one screen and overflow/underfill another, so the preview drew dashed
rectangles for each target screen and letterboxed the design at true proportions
to show what would fit.

- `LayoutPreview.tsx.snapshot` — the contain-fit minimap renderer. Single scale
  factor, square cells, draws safe-zone rectangles + a "you are here" viewport
  indicator. Bounding box floored at `GRID_COLS` (48), which is why a portrait
  (36-col) design showed right-margin.
- `LayoutEditorPreviewPanel.tsx.snapshot` — the preview popover: the minimap plus
  per-screen-size toggle chips and validation messages.
- `useScreenSafeZones.ts.snapshot` — computed each target screen's `{cols, rows}`
  from its resolution (`rows = round(cols * h / w)`), stored a configurable screen
  list in localStorage.

## Why it was replaced

The dashboard moved to a **stretch-to-fill** model (see the
`feat/dashboard-scale-to-fit` commits): the design is a content-shaped canvas that
**stretches to fill any same-orientation screen** and letterboxes only on a real
orientation mismatch. That makes "will it fit screen X?" moot — it always fits —
so the multi-screen safe-zone framing lost its purpose. The preview was repurposed
into a **device-aspect gallery** (`DevicePreviewGallery`) that shows the *same*
layout rendered the way each device would actually show it (the stretch/squish per
aspect), reusing the device-resolution idea rather than the fixed-scale fitting.

## Reviving it

If a future need arises for true fixed-aspect fitting (e.g. odd-aspect e-readers
like Kindle Kids tablets, or an explicit "this must fit exactly" mode), these
files are the working reference. The contain path also still exists live in
`CssGridDisplay.tsx` (used on genuine orientation mismatch), so a fixed-aspect
preview can be rebuilt from that + this snapshot.
