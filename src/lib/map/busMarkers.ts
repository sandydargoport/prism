/**
 * Drawings for the live bus marker. Each is seen from above with its front
 * at the top, so rotating it by the heading points it down the road; a side
 * view would turn upside down whenever the bus heads west.
 *
 * All original designs. Famous fictional vehicles and real car models belong
 * to someone else, so these borrow the spirit, never the look.
 *
 * Plain strings rather than components: the marker is a DOM element MapLibre
 * owns, and the settings picker shows the same markup as a preview.
 */

export const BUS_MARKER_SETTING = 'busMarker';

export const BUS_MARKERS = ['school', 'seasonal', 'night', 'submarine', 'saucer', 'wedge', 'cruiser'] as const;
export type BusMarker = (typeof BUS_MARKERS)[number];
export const DEFAULT_BUS_MARKER: BusMarker = 'school';

export const BUS_MARKER_LABELS: Record<BusMarker, string> = {
  school: 'School bus',
  seasonal: 'School bus, dressed for the month',
  night: 'Night double-decker',
  submarine: 'Submarine',
  saucer: 'Flying saucer',
  wedge: 'Steel wedge truck',
  cruiser: 'Night cruiser',
};

export function isBusMarker(value: unknown): value is BusMarker {
  return typeof value === 'string' && (BUS_MARKERS as readonly string[]).includes(value);
}

/** What rides on the roof of the seasonal bus, by month (1-12). */
export const SEASON_EMOJI: Record<number, string> = {
  1: '❄️', 2: '❤️', 3: '☘️', 4: '🌷', 5: '🌸', 6: '☀️',
  7: '🎆', 8: '🍉', 9: '🍎', 10: '🎃', 11: '🍂', 12: '🎄',
};

interface Drawing { width: number; height: number; svg: string }

const OUTLINE = 'stroke="#1f2937" stroke-width="1"';

const SCHOOL = `
  <rect x="2" y="1" width="20" height="46" rx="4" fill="#f5b800" ${OUTLINE}/>
  <rect x="4" y="2.5" width="16" height="6" rx="2" fill="#e0a300"/>
  <rect x="3.5" y="9" width="17" height="3.5" rx="1" fill="#334155"/>
  <rect x="8" y="17" width="8" height="5" rx="1" fill="#fff7d6" ${OUTLINE}/>
  <rect x="8" y="33" width="8" height="5" rx="1" fill="#fff7d6" ${OUTLINE}/>
  <line x1="3" y1="14" x2="3" y2="45" stroke="#1f2937" stroke-width="1.2"/>
  <line x1="21" y1="14" x2="21" y2="45" stroke="#1f2937" stroke-width="1.2"/>
  <rect x="4" y="45" width="3" height="1.5" fill="#dc2626"/>
  <rect x="17" y="45" width="3" height="1.5" fill="#dc2626"/>`;

const DRAWINGS: Record<Exclude<BusMarker, 'seasonal'>, Drawing> = {
  school: { width: 24, height: 48, svg: SCHOOL },
  night: {
    width: 24, height: 48, svg: `
      <rect x="2" y="1" width="20" height="46" rx="5" fill="#5b21b6" ${OUTLINE}/>
      <rect x="4" y="3" width="16" height="4" rx="1.5" fill="#1e1b4b"/>
      ${[11, 17, 23, 29, 35, 41].map((y) => `
        <rect x="3.5" y="${y}" width="3" height="4" rx="0.8" fill="#fde68a"/>
        <rect x="17.5" y="${y}" width="3" height="4" rx="0.8" fill="#fde68a"/>`).join('')}
      <rect x="9" y="12" width="6" height="30" rx="2" fill="#4c1d95"/>
      <circle cx="12" cy="9" r="1.6" fill="#fbbf24"/>`,
  },
  submarine: {
    width: 24, height: 48, svg: `
      <path d="M12 1 C20 6 21 36 17 43 L7 43 C3 36 4 6 12 1 Z" fill="#f97316" ${OUTLINE}/>
      <path d="M7 41 L2 46 L8 44 Z M17 41 L22 46 L16 44 Z" fill="#c2410c" ${OUTLINE}/>
      <ellipse cx="12" cy="20" rx="3.5" ry="6" fill="#fdba74" ${OUTLINE}/>
      <circle cx="12" cy="16" r="1.3" fill="#1f2937"/>
      ${[28, 33, 38].map((y) => `<circle cx="12" cy="${y}" r="1.4" fill="#7dd3fc" ${OUTLINE}/>`).join('')}
      <rect x="10.5" y="44" width="3" height="3" rx="1" fill="#57534e"/>`,
  },
  saucer: {
    width: 40, height: 40, svg: `
      <circle cx="20" cy="20" r="18" fill="#9ca3af" ${OUTLINE}/>
      <circle cx="20" cy="20" r="13" fill="#d1d5db" ${OUTLINE}/>
      <circle cx="20" cy="20" r="7" fill="#34d399" fill-opacity="0.9" ${OUTLINE}/>
      <circle cx="18" cy="18" r="2" fill="#ecfdf5"/>
      ${[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        return `<circle cx="${(20 + 15.5 * Math.sin(r)).toFixed(1)}" cy="${(20 - 15.5 * Math.cos(r)).toFixed(1)}" r="1.4" fill="${a === 0 ? '#f43f5e' : '#fde047'}"/>`;
      }).join('')}`,
  },
  wedge: {
    width: 24, height: 48, svg: `
      <path d="M3 3 L21 3 L22 46 L2 46 Z" fill="#c4cad3" ${OUTLINE}/>
      <path d="M4 4 L20 4 L12 22 Z" fill="#475569"/>
      <path d="M12 22 L21 46 M12 22 L3 46" stroke="#8b95a3" stroke-width="0.8"/>
      <rect x="3" y="3" width="18" height="1.2" fill="#f8fafc"/>
      <rect x="3" y="44.5" width="18" height="1.5" fill="#dc2626"/>`,
  },
  cruiser: {
    width: 28, height: 48, svg: `
      <path d="M8 38 L1 47 L9 44 Z M20 38 L27 47 L19 44 Z" fill="#111827" ${OUTLINE}/>
      <path d="M14 1 C19 4 21 12 21 22 L21 44 L7 44 L7 22 C7 12 9 4 14 1 Z" fill="#1f2937" ${OUTLINE}/>
      <path d="M14 10 C17 12 18 16 18 21 L10 21 C10 16 11 12 14 10 Z" fill="#38bdf8" fill-opacity="0.8"/>
      <rect x="11" y="26" width="6" height="12" rx="2" fill="#374151"/>
      <rect x="8" y="42.5" width="4" height="1.5" fill="#ef4444"/>
      <rect x="16" y="42.5" width="4" height="1.5" fill="#ef4444"/>`,
  },
};

/** The drawing's markup and its on-map size in px. */
export function busMarkerDrawing(kind: BusMarker): Drawing {
  return DRAWINGS[kind === 'seasonal' ? 'school' : kind];
}

/** A full <svg> element as a string, at the given scale. */
export function busMarkerSvg(kind: BusMarker, scale = 1): string {
  const d = busMarkerDrawing(kind);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d.width} ${d.height}" width="${d.width * scale}" height="${d.height * scale}">${d.svg}</svg>`;
}
