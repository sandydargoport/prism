/**
 * Layout validation logic shared by the app (pre-export, import) and CI.
 * Pure functions — no React, no DB.
 */

// Widget minimum sizes — extracted from WIDGET_REGISTRY to avoid importing React components
export const WIDGET_CONSTRAINTS: Record<string, { minW: number; minH: number }> = {
  clock:     { minW: 2, minH: 2 },
  weather:   { minW: 2, minH: 2 },
  calendar:  { minW: 3, minH: 4 },
  tasks:     { minW: 2, minH: 3 },
  messages:  { minW: 2, minH: 3 },
  chores:    { minW: 2, minH: 3 },
  shopping:  { minW: 2, minH: 3 },
  meals:     { minW: 3, minH: 3 },
  birthdays: { minW: 2, minH: 3 },
  photos:    { minW: 2, minH: 2 },
  points:    { minW: 2, minH: 3 },
};

export const VALID_WIDGET_IDS = Object.keys(WIDGET_CONSTRAINTS);

export interface CommunityWidget {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible?: boolean;
  backgroundColor?: string;
  backgroundOpacity?: number;
}

export interface CommunityLayoutData {
  type: 'prism-layout';
  version: number;
  mode: 'dashboard' | 'screensaver';
  name: string;
  description: string;
  author: string;
  tags: string[];
  screenSizes: string[];
  orientation: 'landscape' | 'portrait';
  widgets: CommunityWidget[];
}

export interface CommunityIndexEntry {
  id: string;
  file: string;
  name: string;
  description: string;
  author: string;
  mode: 'dashboard' | 'screensaver';
  tags: string[];
  screenSizes: string[];
  orientation: string;
  widgetCount: number;
  createdAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationOptions {
  /** Enable stricter checks for community gallery submissions */
  communitySubmission?: boolean;
  /** Existing community layouts to check for duplicates */
  existingLayouts?: CommunityIndexEntry[];
  /** Widget arrays from existing layouts for near-duplicate comparison */
  existingWidgetSets?: CommunityWidget[][];
}

// Basic profanity word list — kept minimal, catches the obvious ones
const PROFANITY_LIST = [
  'shit', 'fuck', 'ass', 'asshole', 'bitch', 'bastard', 'damn', 'crap',
  'dick', 'cock', 'pussy', 'slut', 'whore', 'nigger', 'faggot', 'retard',
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY_LIST.some(word => lower.includes(word));
}

/**
 * Compute the set of grid cells occupied by a widget.
 * Returns a Set of "x,y" strings.
 */
function getOccupiedCells(widget: CommunityWidget): Set<string> {
  const cells = new Set<string>();
  for (let cx = widget.x; cx < widget.x + widget.w; cx++) {
    for (let cy = widget.y; cy < widget.y + widget.h; cy++) {
      cells.add(`${cx},${cy}`);
    }
  }
  return cells;
}

/**
 * Compute overlap ratio between two sets of grid cells.
 * Returns the fraction of the union that is shared.
 */
function computeOverlapRatio(
  setA: Set<string>,
  setB: Set<string>,
): number {
  let intersection = 0;
  for (const cell of setA) {
    if (setB.has(cell)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Normalize widgets for duplicate comparison:
 * Sort by widget ID, round positions.
 */
function normalizeWidgets(widgets: CommunityWidget[]): string {
  const sorted = [...widgets]
    .sort((a, b) => a.i.localeCompare(b.i))
    .map(w => ({
      i: w.i,
      x: Math.round(w.x),
      y: Math.round(w.y),
      w: Math.round(w.w),
      h: Math.round(w.h),
    }));
  return JSON.stringify(sorted);
}

/**
 * Validate a community layout JSON.
 *
 * @param data - Raw layout data to validate
 * @param options - Validation options (community submission mode, existing layouts for duplicate check)
 * @returns ValidationResult with valid flag, errors, and warnings
 */
export function validateCommunityLayout(
  data: unknown,
  options: ValidationOptions = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Basic type check ---
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['Input must be a non-null object.'], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  // --- Schema fields ---
  if (obj.type !== 'prism-layout') {
    errors.push('Missing or invalid "type" field. Expected "prism-layout".');
  }

  if (typeof obj.version !== 'number' || (obj.version !== 1 && obj.version !== 2)) {
    errors.push('Missing or invalid "version" field. Expected 1 or 2.');
  }

  if (obj.mode !== 'dashboard' && obj.mode !== 'screensaver') {
    errors.push('Missing or invalid "mode" field. Expected "dashboard" or "screensaver".');
  }

  if (!Array.isArray(obj.widgets)) {
    errors.push('Missing or invalid "widgets" field. Expected an array.');
    return { valid: false, errors, warnings };
  }

  const widgets = obj.widgets as unknown[];

  // --- Widget validation ---
  if (widgets.length === 0) {
    errors.push('Layout must have at least 1 visible widget.');
    return { valid: false, errors, warnings };
  }

  // Parse and validate individual widgets
  const parsedWidgets: CommunityWidget[] = [];
  const seenIds = new Set<string>();

  for (let idx = 0; idx < widgets.length; idx++) {
    const w = widgets[idx];
    if (!w || typeof w !== 'object' || Array.isArray(w)) {
      errors.push(`Widget at index ${idx}: must be an object.`);
      continue;
    }

    const wObj = w as Record<string, unknown>;

    // Required fields
    if (typeof wObj.i !== 'string') {
      errors.push(`Widget at index ${idx}: missing or invalid "i" (widget ID).`);
      continue;
    }
    if (typeof wObj.x !== 'number' || typeof wObj.y !== 'number' ||
        typeof wObj.w !== 'number' || typeof wObj.h !== 'number') {
      errors.push(`Widget "${wObj.i || idx}": missing numeric x, y, w, or h.`);
      continue;
    }

    const widget: CommunityWidget = {
      i: wObj.i as string,
      x: wObj.x as number,
      y: wObj.y as number,
      w: wObj.w as number,
      h: wObj.h as number,
    };

    // Valid widget ID
    if (!VALID_WIDGET_IDS.includes(widget.i)) {
      errors.push(`Widget "${widget.i}": unknown widget ID. Valid IDs: ${VALID_WIDGET_IDS.join(', ')}.`);
    }

    // Duplicate check
    if (seenIds.has(widget.i)) {
      errors.push(`Duplicate widget ID "${widget.i}".`);
    }
    seenIds.add(widget.i);

    // Bounds checks
    if (widget.x < 0) {
      errors.push(`Widget "${widget.i}": x >= 0 required (got ${widget.x}).`);
    }
    if (widget.y < 0) {
      errors.push(`Widget "${widget.i}": y >= 0 required (got ${widget.y}).`);
    }
    if (widget.w < 1) {
      errors.push(`Widget "${widget.i}": w >= 1 required (got ${widget.w}).`);
    }
    if (widget.h < 1) {
      errors.push(`Widget "${widget.i}": h >= 1 required (got ${widget.h}).`);
    }
    if (widget.x + widget.w > 12) {
      errors.push(`Widget "${widget.i}": x + w <= 12 required (got ${widget.x + widget.w}).`);
    }

    // Max Y check
    if (widget.y + widget.h > 30) {
      errors.push(`Widget "${widget.i}": extends beyond y=30 (unreasonable scrolling).`);
    }

    // Minimum size per widget type
    const constraints = WIDGET_CONSTRAINTS[widget.i];
    if (constraints) {
      if (widget.w < constraints.minW) {
        errors.push(`Widget "${widget.i}": w must be >= minW of ${constraints.minW} (got ${widget.w}).`);
      }
      if (widget.h < constraints.minH) {
        errors.push(`Widget "${widget.i}": h must be >= minH of ${constraints.minH} (got ${widget.h}).`);
      }
    }

    parsedWidgets.push(widget);
  }

  // --- Overlap detection ---
  for (let a = 0; a < parsedWidgets.length; a++) {
    for (let b = a + 1; b < parsedWidgets.length; b++) {
      const wa = parsedWidgets[a]!;
      const wb = parsedWidgets[b]!;
      // Check if rectangles overlap
      if (
        wa.x < wb.x + wb.w &&
        wa.x + wa.w > wb.x &&
        wa.y < wb.y + wb.h &&
        wa.y + wa.h > wb.y
      ) {
        errors.push(`Widgets "${wa.i}" and "${wb.i}" overlap.`);
      }
    }
  }

  // --- Warnings ---
  const maxBottom = Math.max(0, ...parsedWidgets.map(w => w.y + w.h));
  if (maxBottom > 24) {
    warnings.push(`Layout is very tall (extends to row ${maxBottom}). May require scrolling on most screens.`);
  }

  // --- Community submission checks ---
  if (options.communitySubmission) {
    const name = typeof obj.name === 'string' ? obj.name : '';
    const description = typeof obj.description === 'string' ? obj.description : '';
    const author = typeof obj.author === 'string' ? obj.author : '';
    const screenSizes = Array.isArray(obj.screenSizes) ? obj.screenSizes : [];
    const orientation = obj.orientation;

    if (name.length === 0 || name.length > 100) {
      errors.push('Community submission requires a name (1-100 characters).');
    }
    if (description.length === 0) {
      errors.push('Community submission requires a non-empty description.');
    }
    if (author.length === 0 || author.length > 50) {
      errors.push('Community submission requires an author (1-50 characters).');
    }
    if (screenSizes.length === 0) {
      errors.push('Community submission requires at least one screen size.');
    }
    if (orientation !== 'landscape' && orientation !== 'portrait') {
      errors.push('Community submission requires orientation ("landscape" or "portrait").');
    }

    // Minimum 3 visible widgets
    if (parsedWidgets.length < 3) {
      errors.push('Community submission requires at least 3 visible widgets.');
    }

    // Profanity filter
    if (containsProfanity(name) || containsProfanity(description) || containsProfanity(author)) {
      errors.push('Content policy violation. Please revise your text.');
    }

    // Duplicate / near-duplicate detection
    if (options.existingLayouts && options.existingWidgetSets) {
      const normalizedNew = normalizeWidgets(parsedWidgets);
      const newCells = new Set<string>();
      for (const w of parsedWidgets) {
        for (const cell of getOccupiedCells(w)) {
          newCells.add(cell);
        }
      }

      for (let i = 0; i < options.existingWidgetSets.length; i++) {
        const existingSet = options.existingWidgetSets[i]!;
        const existingEntry = options.existingLayouts[i];

        // Exact duplicate
        const normalizedExisting = normalizeWidgets(existingSet);
        if (normalizedNew === normalizedExisting) {
          errors.push(`Duplicate of existing layout "${existingEntry?.name || 'unknown'}".`);
          break;
        }

        // Near-duplicate (>85% grid cell overlap)
        const existingCells = new Set<string>();
        for (const w of existingSet) {
          for (const cell of getOccupiedCells(w)) {
            existingCells.add(cell);
          }
        }
        const overlap = computeOverlapRatio(newCells, existingCells);
        if (overlap > 0.85) {
          errors.push(`Too similar to existing layout "${existingEntry?.name || 'unknown'}" (${Math.round(overlap * 100)}% overlap).`);
          break;
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
