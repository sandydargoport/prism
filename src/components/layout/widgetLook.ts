/**
 * A widget's look across a whole dashboard (#1339): its fill, outline and
 * text, copied to every widget, and given to a new widget when the others all
 * share one. No schema of its own: each widget keeps its own copy of the
 * values, as when they are set one at a time.
 */
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

export type LookPart = 'fill' | 'outline' | 'text';

export const LOOK_PARTS: readonly LookPart[] = ['fill', 'outline', 'text'];

/** The fields each part of the look is made of. */
const FIELDS = {
  fill: ['backgroundColor', 'backgroundOpacity'],
  outline: ['outlineColor', 'outlineOpacity'],
  text: ['textColor', 'textScale'],
} as const satisfies Record<LookPart, ReadonlyArray<keyof WidgetConfig>>;

type LookField = (typeof FIELDS)[LookPart][number];

/** A field left unset draws as this, so unset and the default value are the same look. */
const UNSET_AS: Partial<Record<LookField, number>> = { backgroundOpacity: 1, outlineOpacity: 1, textScale: 1 };

const valueOf = (w: WidgetConfig, f: LookField) => w[f] ?? UNSET_AS[f];

/** The two widgets have the same `part`. */
export function sameLook(a: WidgetConfig, b: WidgetConfig, part: LookPart): boolean {
  return FIELDS[part].every((f) => valueOf(a, f) === valueOf(b, f));
}

/** `target` with `source`'s `part`: a field `source` leaves unset is unset on the copy too. */
function withLook(target: WidgetConfig, source: WidgetConfig, part: LookPart): WidgetConfig {
  const next: WidgetConfig = { ...target };
  const rec = next as unknown as Record<string, unknown>;
  for (const f of FIELDS[part]) {
    if (source[f] === undefined) delete rec[f];
    else rec[f] = source[f];
  }
  return next;
}

/** Every widget, hidden ones too, with `source`'s `part`. A widget that already has it is left as it is. */
export function applyLookToAll(widgets: WidgetConfig[], source: WidgetConfig, part: LookPart): WidgetConfig[] {
  return widgets.map((w) => (sameLook(w, source, part) ? w : withLook(w, source, part)));
}

/** How many of the widgets on show, other than `source`, have a different `part`. */
export function countDiffering(widgets: WidgetConfig[], source: WidgetConfig, part: LookPart): number {
  return widgets.filter((w) => w.i !== source.i && w.visible !== false && !sameLook(w, source, part)).length;
}

/**
 * `added` with each part of the look the widgets on show all share. A part
 * they do not agree on, or that is the default on all of them, is left as
 * `added` has it.
 */
export function withSharedLook(widgets: WidgetConfig[], added: WidgetConfig): WidgetConfig {
  const shown = widgets.filter((w) => w.visible !== false && w.i !== added.i);
  if (shown.length === 0) return added;
  const first = shown[0]!;
  const rest = shown.slice(1);
  let next = added;
  for (const part of LOOK_PARTS) {
    if (rest.every((w) => sameLook(w, first, part))) next = withLook(next, first, part);
  }
  return next;
}

/**
 * Look > All widgets (#1350): one choice for every widget's fill, outline or
 * text colour, in place of copying one widget's. Each is a colour field; the
 * empty string is the theme's own, which a widget has when the field is unset.
 */
export const ALL_WIDGET_CHOICES: Record<LookPart, ReadonlyArray<readonly [string, string]>> = {
  fill: [['', 'Theme'], ['glass', 'Glass'], ['frosted', 'Frosted'], ['transparent', 'None']],
  outline: [['', 'Theme'], ['transparent', 'None']],
  text: [['', 'Theme'], ['#FFFFFF', 'Light'], ['#000000', 'Dark']],
};

const COLOUR_FIELD = { fill: 'backgroundColor', outline: 'outlineColor', text: 'textColor' } as const;
/** The opacity that goes with the colour, put back to unset with it; text keeps its size and opacity. */
const OPACITY_FIELD = { fill: 'backgroundOpacity', outline: 'outlineOpacity', text: null } as const;

/** A widget's colour for `part`, the empty string for the theme's. */
export const colourOf = (w: WidgetConfig, part: LookPart): string => w[COLOUR_FIELD[part]] ?? '';

/** The colour most of the widgets on show have for `part`; the theme's with none on show. */
export function commonColour(widgets: WidgetConfig[], part: LookPart): string {
  const counts = new Map<string, number>();
  for (const w of widgets) {
    if (w.visible === false) continue;
    const c = colourOf(w, part);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best = '';
  let most = 0;
  for (const [c, n] of counts) if (n > most) { best = c; most = n; }
  return best;
}

/** How many widgets on show have another colour for `part`. */
export function differFrom(widgets: WidgetConfig[], part: LookPart, colour: string): number {
  return widgets.filter((w) => w.visible !== false && colourOf(w, part) !== colour).length;
}

/** Every widget, hidden ones too, with `colour` for `part`; one that has it already is left as it is. */
export function colourOnAll(widgets: WidgetConfig[], part: LookPart, colour: string): WidgetConfig[] {
  return widgets.map((w) => {
    if (colourOf(w, part) === colour) return w;
    const next: WidgetConfig = { ...w };
    const rec = next as unknown as Record<string, unknown>;
    if (colour) rec[COLOUR_FIELD[part]] = colour;
    else delete rec[COLOUR_FIELD[part]];
    const opacity = OPACITY_FIELD[part];
    if (opacity) delete rec[opacity];
    return next;
  });
}
