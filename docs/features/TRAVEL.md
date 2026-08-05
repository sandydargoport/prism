# Travel Map

![Travel globe with pins](../demos/travel-globe.png){ .hero-image }

Interactive 3D globe for tracking family travel. Drop pins for places you've visited or want to visit, build multi-stop trips (route / loop / hub), and link GPS-tagged OneDrive photos to the places where they were taken. Built with MapLibre GL + OpenFreeMap tiles: no API keys, no rate limits, no vendor lock-in.

---

## What's a Travel pin vs. a Trip

The Travel Map has two object types:

- **Pin**: a single place. Anchored by lat/lng coordinates, has a name, status (visited / want-to-go), bucket-list flag, dates, notes, tags.
- **Trip**: a multi-stop journey composed of pins. Has its own name + style (route / loop / hub) + dates. Each stop in a trip is itself a pin (with `pinType: 'stop'` or `'national_park'`).

Both render on the globe simultaneously. Standalone pins are independent; trip stops are children of a trip object.

---

## Places (standalone pins)

The **Places** tab lists every standalone pin with stats, filters, and search.

### Statuses

Pins have a status, color-coded on the globe:

- **Been there** (green checkmark): visited.
- **Want to go** (white dot): on the wishlist.
- **Bucket list** (amber star): high-priority must-visit. Independent flag, works on either status.

Toggling status auto-saves immediately. No Save button needed for the toggle.

### National parks badge

Pins with at least one entry in their `nationalParks` array get a **green tree badge**. The list contains the official NPS-registered park names (e.g. "Yellowstone National Park", "Grand Canyon National Park"). Used for filtering and the "Has NP" filter pill.

### Filters

Filter pills at the top of the Places tab:

- **All**: every pin
- **Been there**
- **Want to Go**
- **Bucket List**
- **Has NP** (national park)

Plus:

- **Group by**: Year / Country / None. Country grouping shows the country flag emoji as the section header.
- **Search**: case-insensitive substring match on place/trip name.

The list is ordered automatically (there's no sort control): visited places sort newest-first by visit date; everything else falls back to alphabetical by name.

Selecting a place jumps to the globe view and opens its detail panel.

---

## Adding a place

Two ways:

1. **Geocoded search.** Type a place name in the side panel, pick from Nominatim suggestions. The pin lands at the geocoded coordinates with the official name + country.
2. **Click on the globe.** Drop a pin at any clicked coordinate. The geocode runs in reverse to fetch a place name.

The slide-out panel has a **Place / Trip toggle** when adding something new. Switch between adding a standalone pin and creating a multi-stop trip without leaving the panel.

### Editing a pin

Click any pin to open its detail panel. Edits happen inline, no separate edit modal:

- **Name**
- **Trip label** (a free-text grouping like "Spring Break 2026", independent of formal Trip objects)
- **Status toggle** (auto-saves)
- **Bucket list star** (auto-saves)
- **Visit dates**: start + optional end.
- **Description**
- **Tags**

### Re-locating a misplaced pin

Pencil icon next to the coordinates opens an inline geocode search. Type a new location, pick a result, the pin's lat/lng + place name update in place. Useful when the geocoder dropped a pin in the wrong town with the same name (e.g. "Springfield", there are like 30 of them).

---

## Trips

A trip is a multi-stop journey. Three styles, picked when you create the trip:

- **Route**: A → B → C → D. Polyline connects stops in order.
- **Loop**: A → B → C → A. Closed polyline returning to the start.
- **Hub**: home base + day-trip spokes. The home stop is marked `isHub: true`; other stops radiate from it.

Trips are first-class objects separate from standalone pins. Creating a trip happens via the **Place / Trip toggle** in the add panel.

### Trip stops

Each stop in a trip is a pin with `pinType: 'stop'` or `pinType: 'national_park'`. Stops support:

- All the same fields as standalone pins.
- A **sortOrder** for drawing the polyline in the right sequence.
- An optional **national park** flag: NP stops render with a green tree icon instead of a number badge.

Drag-to-reorder stops within a trip from the trip's detail panel.

### Trip rendering

All trips are always visible on the globe simultaneously:

- **Inactive trips** render as small faded colored dots + thin low-opacity connecting lines. Just enough to know they're there.
- **The active (selected) trip** shows full numbered markers + a bright dashed connecting line. The trip's color theme applies to all its markers.

Click any faint dot to select that trip (the click bubbles up from the marker to its parent trip).

### Active trip indicators

When a trip is selected:

- The trip's name + dates appear in a banner at the top of the globe.
- The stop list in the side panel shows numbered stops in order.
- The polyline connects the stops with the trip's color.
- NP stops keep their green tree icon (even in the active trip).

---

## GPS photo linking

If your OneDrive photo sync is configured, **geotagged photos automatically match to nearby travel pins**. The pin's detail panel shows a photo strip of matching shots within a fixed 50 km radius.

### How matching works

Matching is computed **live** each time you open a pin's detail panel. There are no stored links and no background linking job.

1. When a photo syncs from OneDrive, its EXIF GPS coordinates (if present) are stored on the `photos` row.
2. When the pin panel opens, the Travel Map calculates the Haversine distance from the pin (and all its child stops / national parks) to every photo that has GPS, using a bounding-box SQL prefilter followed by a precise radius check.
3. Photos within the 50 km radius are returned on the fly and rendered as a horizontal photo strip. Tap any photo for a lightbox.

### GPS backfill

For photos that synced before GPS was captured, run *Settings → Photos → Backfill GPS*. This reads EXIF GPS data from already-synced files (no re-download needed) and populates the `photos.latitude` / `photos.longitude` columns. Once a photo has coordinates, it shows up automatically the next time you open a nearby pin.

### Match radius

The 50 km match radius (`photoRadiusKm`) is a fixed default set on the API/DB side. There is no UI to change it per pin today, and the value isn't editable from the pin panel.

---

## Globe controls

- **Drag** to rotate.
- **Scroll wheel** / **pinch** to zoom.
- **Sun / moon button** in the corner toggles a dark-map filter. The filter applies a CSS `brightness · saturate · contrast · hue-rotate` chain only to the tile canvas, not to markers: tiles darken, markers stay at full brightness. No tile reload required.
- **Globe vs. flat projection**: default is globe (3D); MapLibre's `projection: globe` config. At certain zoom levels MapLibre may smoothly transition to mercator-flat for closer views.
- **Sub-locations toggle** (top-left): when on, every pin's child stops and national parks are shown on the globe at once; when off, children appear only for the currently selected pin.

### Initial zoom

Default zoom is set so the Earth nearly fills the screen on load. Adjust by manipulating `zoom` in the initial view options if you want it tighter or wider by default.

---

## Geocoding

Two services power location lookup:

- **Nominatim**: OpenStreetMap-based, accessed via `/api/travel/geocode` (server-side proxy to OpenStreetMap's Nominatim). Used for general place search.
- **NPS curated list**: for the "Add national park" action in trips, a static curated list of US National Parks + Monuments. This bypasses Nominatim because Nominatim's results for park names often surface natural features (e.g. "Hawai'i Volcanoes" matches the volcano summit, not the park boundary).

### Quirks the geocoder handles

- **Hawaiian island aliases**: "Big Island" → "Hawaiʻi Island"; "Kauai" → "Kauaʻi".
- **Special characters**: diacritics normalized for fuzzy matching.
- **National park boundary scoring**: for NP queries, results with `class=boundary` or `class=park` rank above natural features.

---

## Use cases

### Family travel scrapbook

Drop a pin for every place you've been together. Use status filters to show what's already in the bag. Pin photos auto-link via GPS so each pin becomes a mini-album.

### Planning the next trip

Create a trip with route style for a road trip. Add stops in order. The polyline previews the route on the globe. Use bucket-list flag for "places we want to fit in but haven't committed yet."

### "Have we been to all the national parks?"

Tag pins with national park entries. The "Has NP" filter shows your park-collection progress. Combine with the curated NPS list to discover parks you haven't been to.

### Personal globe wallpaper

The globe view is screensaver-friendly. Add the Travel Map widget to your screensaver layout for a slow-rotating Earth showing your family's footprint.

---

## Privacy

Travel data is stored in your Prism database. Coordinates, place names, dates, and photo links don't leave your instance.

The geocoder calls `/api/travel/geocode` server-side, which proxies to Nominatim (OpenStreetMap's public service). Nominatim sees your geocode queries (place name lookups) but not your saved pins.

Tile rendering uses OpenFreeMap (`https://tiles.openfreemap.org/...`). Map tile requests are public web requests; they reveal which part of the globe you're zoomed into when interacting with the map, but no personal data.

If you want extra isolation, self-host OpenFreeMap tiles. The project publishes Docker images for the tile server. Then update the tile URL in the globe component.

---

## Troubleshooting

### Pin appears in the wrong location

Nominatim disambiguation is imperfect. Click the pencil icon next to the coordinates and search for a more specific name (e.g. "Springfield, IL" instead of "Springfield"). The pin updates in place.

### "Something went wrong" creating a pin

In older versions, the Zod schema rejected `null` for optional fields (only `undefined` worked). Fixed in v1.4. If you still see this on creation, file an issue with the exact name + tags.

### Pin visible on the wrong side of the globe (through the Earth)

Was a bug in early v1.5: far-side pin culling wasn't applying the `!important` CSS flag, so MapLibre overrode visibility. Fixed. Hard-reload to clear cached chunks.

### Status toggle doesn't persist

Each status toggle (been there / want to go) and bucket list star auto-saves on click. If a toggle reverts, check the network tab for the PATCH request. Most often a 401 (session expired). Re-login.

### Photos not linking to pins

Three possible causes:

1. Photos don't have GPS EXIF data. Check the photo's metadata; not all phones embed GPS, and iOS strips it on share unless "preserve location" is enabled.
2. Photos haven't been GPS-backfilled. Run *Settings → Photos → Backfill GPS*.
3. The place is more than 50 km from where the photos were taken. Matching uses a fixed 50 km radius, so distant shots won't attach.

### Globe rotation feels jerky on a Pi

MapLibre's globe projection is GPU-intensive. On low-power hardware:

- Enable Performance Mode (*Settings → Appearance*).
- Disable other widgets to leave more GPU headroom.
- Or fall back to the (less impressive but lighter) flat-mercator view by setting `projection: 'mercator'` in the globe init.

### "Hawaii Volcanoes" pin is on top of the volcano summit

Was a Nominatim ranking quirk, fixed by boosting boundary/park results over natural features for NP queries. If you still see this on Hawai'i Volcanoes (or another park), file an issue and update the manual override list.

### Trip polyline crosses the antimeridian (180° line) awkwardly

Known MapLibre issue. Trips that span the Pacific (e.g. US to Japan) will draw the polyline the long way around. Workaround: split into two trips that don't cross the line, or accept the visual quirk.
