import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * MapLibre, configured for a Next build. Import maplibregl from here rather
 * than from the package so every map gets the worker fix.
 *
 * maplibre-gl v6 is ESM-only and finds its worker via
 * `new URL('./maplibre-gl-worker.mjs', import.meta.url)`. Webpack does not
 * preserve import.meta.url, so in a Next build that resolves to '' and the
 * worker is constructed against the page itself and dies immediately. Nothing
 * throws: the map still draws its raster sources, so it comes up with land
 * shading but no water, boundaries or labels.
 *
 * scripts/copy-maplibre-worker.mjs puts the worker (and the shared chunk it
 * imports) under public/maplibre at build time; this points MapLibre at it.
 */
maplibregl.config.WORKER_URL = '/maplibre/maplibre-gl-worker.mjs';

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** A font the style's glyph server carries, for labels we add ourselves. */
export const MAP_LABEL_FONT = ['Noto Sans Regular'];

export { maplibregl };
