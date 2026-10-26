#!/usr/bin/env node
/**
 * Regenerates src/components/screensaver/nightSky/catalog.ts from the
 * d3-celestial data files (BSD-3-Clause, Olaf Frohn; star positions from the
 * XHIP Hipparcos compilation, lines from the IAU constellation charts).
 *
 *   node scripts/gen-night-sky-catalog.mjs <stars.6.json> <constellations.lines.json> <mw.json> \
 *     <constellations.json> <starnames.json>
 *
 * All five are in the d3-celestial npm package under data/. Stars are kept
 * down to magnitude 6, about the faintest the eye sees on a dark night: one by
 * one they are barely there, but together they are what gives the sky depth.
 * The Milky Way outlines (Jose R. Vieira's catalogue) become a one-degree
 * brightness grid; see below.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const [starsPath, linesPath, mwPath, namesPath, starNamesPath] = process.argv.slice(2);
if (!starsPath || !linesPath || !mwPath || !namesPath || !starNamesPath) {
  console.error('usage: gen-night-sky-catalog.mjs <stars.6.json> <constellations.lines.json> <mw.json> <constellations.json> <starnames.json>');
  process.exit(1);
}

const MAG_LIMIT = 6;
// GeoJSON longitude runs -180..180; right ascension 0..360.
const ra = (lon) => (lon < 0 ? lon + 360 : lon);
const r1 = (n) => Math.round(n * 10) / 10;

const allStars = JSON.parse(readFileSync(starsPath, 'utf8')).features;
const stars = allStars
  .filter((f) => f.properties.mag <= MAG_LIMIT)
  .sort((a, b) => a.properties.mag - b.properties.mag)
  .flatMap((f) => {
    const [lon, dec] = f.geometry.coordinates;
    const bv = Number(f.properties.bv);
    return [r1(ra(lon)), r1(dec), r1(f.properties.mag), Number.isFinite(bv) ? r1(bv) : 0.6];
  });

const lineFeatures = JSON.parse(readFileSync(linesPath, 'utf8')).features;
const lines = lineFeatures
  .flatMap((f) => f.geometry.coordinates)
  .map((line) => line.flatMap(([lon, dec]) => [r1(ra(lon)), r1(dec)]));

// One figure per constellation, for the screensaver to teach one at a time:
// its stars, the strokes between them, its name and what the name means.
//
// The meanings are d3-celestial's English names, except where that is only the
// Latin again (a figure named for a person) or names something else: Ursa
// Major's "Big Dipper" is the pattern inside it, not the bear.
const MEANING = {
  And: 'the Chained Princess', Aqr: 'the Water Bearer', Cap: 'the Sea Goat', Cas: 'the Queen',
  Cep: 'the King', Cha: 'the Chameleon', Eri: 'the River', Her: 'the Hero', Hyi: 'the Little Water Snake',
  Lyn: 'the Lynx', Men: 'the Table Mountain', Oph: 'the Serpent Bearer', Ori: 'the Hunter',
  Peg: 'the Winged Horse', Per: 'the Hero', Phe: 'the Phoenix', Pup: 'the Stern', Scl: 'the Sculptor',
  UMa: 'the Great Bear', UMi: 'the Little Bear', Com: "Berenice's Hair",
};
const NAME = { Ser: 'Serpens' };
const named = new Map(
  JSON.parse(readFileSync(namesPath, 'utf8')).features.map((f) => [f.id, f.properties]),
);
const starNames = JSON.parse(readFileSync(starNamesPath, 'utf8'));
/** The catalogue star at a figure's vertex: its magnitude and, if bright, its name. */
const starAt = (raDeg, dec) => {
  let best = null;
  let bestD = 0.25;
  for (const f of allStars) {
    const [lon, sd] = f.geometry.coordinates;
    const d = Math.hypot((ra(lon) - raDeg) * Math.cos((dec * Math.PI) / 180), sd - dec);
    if (d < bestD) { best = f; bestD = d; }
  }
  if (!best) return { mag: 6, name: '', home: '' };
  const entry = starNames[best.id];
  const name = best.properties.mag <= 2.6 ? entry?.name ?? '' : '';
  return { mag: best.properties.mag, name, home: entry?.c ?? '' };
};
/** Names for a figure's brightest stars that belong to it: three at most, so they can be read. */
const LABELS = 3;
const figures = new Map();
for (const f of lineFeatures) {
  let fig = figures.get(f.id);
  if (!fig) {
    const p = named.get(f.id);
    fig = {
      id: f.id,
      name: NAME[f.id] ?? p.name,
      meaning: MEANING[f.id] ?? `the ${p.en}`,
      rank: Number(p.rank),
      v: [],
      e: [],
      labels: [],
      named: [],
      keys: new Map(),
    };
    figures.set(f.id, fig);
  }
  const vertex = ([lon, dec]) => {
    const key = `${r1(ra(lon))},${r1(dec)}`;
    if (!fig.keys.has(key)) {
      const star = starAt(ra(lon), dec);
      fig.keys.set(key, fig.v.length / 3);
      if (star.name && star.home === f.id) fig.named.push([fig.v.length / 3, star.name, star.mag]);
      fig.v.push(r1(ra(lon)), r1(dec), r1(star.mag));
    }
    return fig.keys.get(key);
  };
  for (const stroke of f.geometry.coordinates) {
    for (let i = 1; i < stroke.length; i++) fig.e.push(vertex(stroke[i - 1]), vertex(stroke[i]));
  }
}
const figureList = [...figures.values()].map(({ keys: _keys, named, ...fig }) => ({
  ...fig,
  labels: named.sort((a, b) => a[2] - b[2]).slice(0, LABELS).flatMap(([i, name]) => [i, name]),
}));

// The Milky Way outlines come as five nested brightness steps, each a set of
// rings, with the dark lanes of dust as holes. They are rasterised here onto a
// one-degree grid of right ascension by declination, holding how many steps
// cover each cell, so the screen can look the brightness up rather
// than fill polygons. Filling them on screen goes wrong where a ring passes
// behind the viewer, and the two rings that edge the faintest step run all the
// way round the sky, which no flat polygon fill gets right.
//
// Each cell is inside a step if a ray from its centre due north crosses that
// step's rings an odd number of times. A ring round the sky then counts as
// closed over the north pole, and the band between its two edges comes out of
// the odd-even rule on its own.
const GRID_W = 360;
const GRID_H = 180;
const sky = new Uint8Array(GRID_W * GRID_H);
for (const step of JSON.parse(readFileSync(mwPath, 'utf8')).features) {
  const inside = new Uint8Array(GRID_W * GRID_H);
  for (const ring of step.geometry.coordinates.flat()) {
    for (let i = 0; i < ring.length; i++) {
      const [lonA, decA] = ring[i];
      const [lonB, decB] = ring[(i + 1) % ring.length];
      const a = ra(lonA);
      let b = ra(lonB);
      if (b - a > 180) b -= 360;
      else if (a - b > 180) b += 360;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      // Every column centre this edge passes over, on either side of 0h.
      for (let c = Math.ceil(lo - 0.5) + 0.5; c < hi; c++) {
        const dec = decA + ((decB - decA) * (c - a)) / (b - a);
        const col = ((Math.floor(c) % GRID_W) + GRID_W) % GRID_W;
        for (let row = 0; row < GRID_H && -89.5 + row < dec; row++) inside[row * GRID_W + col] ^= 1;
      }
    }
  }
  for (let i = 0; i < sky.length; i++) sky[i] += inside[i];
}
// The steps have hard edges, and the faintest one in places runs straight
// along an hour line for twenty degrees, which reads on screen as a seam.
// A small blur, about two degrees across, softens them into a glow; the
// result is stored in ten levels, 0 to 9.
const KERNEL = [1, 4, 6, 4, 1];
const blur = (src, dx, dy) => {
  const out = new Float32Array(src.length);
  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {
      let sum = 0;
      let weight = 0;
      for (let k = -2; k <= 2; k++) {
        const r = row + k * dy;
        if (r < 0 || r >= GRID_H) continue;
        const c = (col + k * dx + GRID_W) % GRID_W;
        sum += src[r * GRID_W + c] * KERNEL[k + 2];
        weight += KERNEL[k + 2];
      }
      out[row * GRID_W + col] = sum / weight;
    }
  }
  return out;
};
const soft = blur(blur(sky, 1, 0), 0, 1);
const milkyWay = Array.from(soft, (v) => Math.round((v / 5) * 9)).join('');

const out = `/**
 * Bright stars and constellation stick figures, J2000.
 *
 * GENERATED by scripts/gen-night-sky-catalog.mjs; do not edit by hand.
 * Source: d3-celestial (https://github.com/ofrohn/d3-celestial), BSD-3-Clause,
 * Copyright (c) 2015, Olaf Frohn. Star data from XHIP (Anderson & Francis
 * 2012), constellation lines from the IAU charts, Milky Way outlines from the
 * Milky Way Outline Catalog by Jose R. Vieira.
 */

/** Flat [ra°, dec°, magnitude, B-V colour index] per star, brightest first. */
export const STARS: readonly number[] = ${JSON.stringify(stars)};

/** One flat [ra°, dec°, ra°, dec°, ...] polyline per stroke of a figure. */
export const LINES: readonly (readonly number[])[] = ${JSON.stringify(lines)};

/** One constellation's figure, as the screensaver teaches it. */
export type Figure = {
  id: string;
  name: string;
  /** What the name means, ready to show under it: "the Swan". */
  meaning: string;
  /** 1 for the figures most people know, to 3 for the obscure. */
  rank: number;
  /** Flat [ra°, dec°, magnitude] per star of the figure. */
  v: readonly number[];
  /** Flat [from, to] star indexes per stroke. */
  e: readonly number[];
  /** Flat [star index, proper name] for its brightest stars. */
  labels: readonly (number | string)[];
}

export const FIGURES: readonly Figure[] = ${JSON.stringify(figureList)};

/**
 * Milky Way brightness on a one-degree grid, 0 (none) to 9 (brightest), one
 * digit per cell. Row by row from declination -90°, each row from 0h right
 * ascension eastward: cell (ra, dec) is at floor(dec + 90) * 360 + floor(ra).
 */
export const MILKY_WAY = '${milkyWay}';
`;

writeFileSync(new URL('../src/components/screensaver/nightSky/catalog.ts', import.meta.url), out);
console.log(`${stars.length / 4} stars, ${lines.length} lines, ${figureList.length} figures, ${sky.filter(Boolean).length} Milky Way cells`);
