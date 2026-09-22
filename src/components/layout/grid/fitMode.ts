/**
 * How the display grid maps the design canvas onto the real screen.
 *   stretch: both axes flex to fill the available box.
 *   contain: square cells scaled to fit the whole content, letterboxed.
 *   scroll:  fill width with square cells at the content's full height, and
 *            scroll the grid vertically.
 *   legacy:  fill width with square cells, adaptive row count.
 */
export type FitMode = 'stretch' | 'contain' | 'scroll' | 'legacy';

export type FitModeInput = {
  /** Content bounding box, in grid units (origin to furthest used col/row). */
  fitCols: number;
  fitRows: number;
  /** Row count of the design canvas for the layout's orientation. */
  targetRows?: number;
  designOrientation?: 'landscape' | 'portrait';
  screenWide: boolean;
  containMode?: boolean;
  fillHeight?: boolean;
};

export function resolveFitMode({
  fitCols,
  fitRows,
  targetRows,
  designOrientation,
  screenWide,
  containMode = false,
  fillHeight = false,
}: FitModeInput): FitMode {
  const fit = (!!targetRows || containMode) && !fillHeight;
  if (!fit) return 'legacy';
  // containMode always scales-to-fit (screensaver: a sparse ambient layout that
  // should fit any screen without clipping).
  if (containMode) return 'contain';
  // Decide stretch-vs-letterbox from the CONTENT'S OWN SHAPE, not a stored
  // orientation label (which can drift from the actual widgets, e.g. a layout
  // saved as "portrait" but laid out landscape). A wide design on a wide screen
  // (or tall on tall) stretches to fill; a genuine orientation mismatch would be
  // a ~2x skew, so it letterboxes to preserve proportions. `designOrientation`
  // is kept only as a fallback for an empty/degenerate layout.
  const designWide = fitCols !== fitRows
    ? fitCols > fitRows
    : (designOrientation ? designOrientation === 'landscape' : true);
  if (designWide === screenWide) return 'stretch';
  // The shape says "mismatch", but the layout is saved for THIS screen's
  // orientation and its content runs past the bottom of that canvas: it is a
  // landscape design that is longer than one screen, not a portrait design.
  // Letterboxing it would shrink the cells to nothing (and past their floor the
  // grid overflows its box and clips), so show it at full width and scroll.
  const labelWide = designOrientation ? designOrientation === 'landscape' : undefined;
  if (labelWide === screenWide && targetRows && fitRows > targetRows) return 'scroll';
  return 'contain';
}
