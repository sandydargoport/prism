'use client';

/**
 * A selected widget's own settings (#1323): its fill, outline and text, the
 * calendar's grid, and when it shows. They sit in the Widgets panel, beside
 * the canvas on a laptop and below it on a phone, at the panel's own size,
 * so the canvas shows only the screen. They used to be a strip of small
 * pop-ups over the canvas.
 */
import * as React from 'react';
import { useRef, useState } from 'react';
import { EyeOff, Minimize2, Moon, X } from 'lucide-react';
import { WIDGET_REGISTRY } from '@/components/widgets/widgetRegistry';
import { useTheme } from '@/components/providers';
import { getColorPalette, FIXED_COLORS, PALETTE_ORDER, type PaletteId } from '@/lib/constants/colorPalettes';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { cn } from '@/lib/utils';
import { canHideWhenEmpty, hidesWhenEmpty } from './grid/hideWhenEmpty';
import { isTypingTarget } from './grid/editorKeys';
import { applyLookToAll, countDiffering, type LookPart } from './widgetLook';
import { shownWhenIdle } from '@/components/screensaver/calmMode';

/** A change to a widget's look. `null` puts a colour back to the default; a field left out is kept. */
export type WidgetStyleUpdate = {
  backgroundColor?: string | null;
  backgroundOpacity?: number;
  outlineColor?: string | null;
  outlineOpacity?: number;
  textColor?: string | null;
  textOpacity?: number;
  textScale?: number;
  gridLineOpacity?: number;
  cellBackgroundColor?: string | null;
  cellBackgroundOpacity?: number;
};

/** The widget with `updates` applied. */
export function applyWidgetStyle(w: WidgetConfig, updates: WidgetStyleUpdate): WidgetConfig {
  return {
    ...w,
    backgroundColor: updates.backgroundColor === null ? undefined : (updates.backgroundColor ?? w.backgroundColor),
    backgroundOpacity: updates.backgroundOpacity ?? w.backgroundOpacity,
    outlineColor: updates.outlineColor === null ? undefined : (updates.outlineColor ?? w.outlineColor),
    outlineOpacity: updates.outlineOpacity ?? w.outlineOpacity,
    textColor: updates.textColor === null ? undefined : (updates.textColor ?? w.textColor),
    textOpacity: updates.textOpacity ?? w.textOpacity,
    textScale: updates.textScale ?? w.textScale,
    gridLineOpacity: updates.gridLineOpacity ?? w.gridLineOpacity,
    cellBackgroundColor: updates.cellBackgroundColor === null ? undefined : (updates.cellBackgroundColor ?? w.cellBackgroundColor),
    cellBackgroundOpacity: updates.cellBackgroundOpacity ?? w.cellBackgroundOpacity,
  };
}

/** The fill choice in words, shown under the swatches (#803): a swatch alone carries only a tooltip, which a touchscreen never shows. */
export function fillName(c: string | undefined): string {
  if (!c) return 'Default: the theme\'s card';
  if (c === 'transparent') return 'None: the words sit straight on the photo, in light text with a soft shadow';
  if (c === 'glass') return 'Glass: a see-through card over the photo';
  if (c === 'frosted') return 'Frosted: a white, blurred card';
  return 'Solid: a card in this colour';
}

// The panel's own sizes, as on the Screen tab: a 44px target or more for a
// finger, and 32px with a mouse, where editing is done, with the words 12px.
const section = 'm-0 mb-2 text-caption font-medium uppercase tracking-[0.1em] text-muted-foreground';
const chip = (on: boolean) => cn(
  'flex min-h-[48px] items-center gap-1.5 rounded-full border-[1.5px] px-4 text-body transition-colors pointer-fine:min-h-8 pointer-fine:border pointer-fine:px-2.5 pointer-fine:text-caption pointer-fine:font-medium',
  on ? 'border-foreground bg-foreground text-background' : 'border-foreground/30 hover:bg-muted',
);
const swatch = (on: boolean) => cn(
  'h-[44px] w-[44px] shrink-0 overflow-hidden rounded-full border border-foreground/30 transition-transform hover:scale-110 pointer-fine:h-8 pointer-fine:w-8',
  on && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
);
/** A row's name in a column of its own, so every row's choices start at one edge and wrap within it. */
const ROW = 'grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-2 text-body';
const note = 'm-0 text-caption text-muted-foreground';
const iconButton = 'flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-fine:h-8 pointer-fine:w-8';

const pct = (o: number) => `${Math.round(o * 100)}%`;

/** A row: a name, then its choices, a group named `label`. */
function Row({ name, label, children, ...rest }: { name: string; label: string; children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={ROW} {...rest}>
      <span className="text-muted-foreground">{name}</span>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>{children}</div>
    </div>
  );
}

/** Choices of one number, one of them on. */
function Choices({ name, label, value, options, onPick }: {
  name: string;
  label: string;
  value: number;
  options: Array<{ v: number; l: string }>;
  onPick: (v: number) => void;
}) {
  return (
    <Row name={name} label={label}>
      {options.map(({ v, l }) => (
        <button key={v} type="button" aria-pressed={value === v} className={chip(value === v)} onClick={() => onPick(v)}>{l}</button>
      ))}
    </Row>
  );
}

const OPACITIES = [0, 0.25, 0.5, 0.75, 1].map((v) => ({ v, l: pct(v) }));
const BLURS = [{ v: 0.25, l: 'Light' }, { v: 0.5, l: 'Med' }, { v: 0.75, l: 'Heavy' }, { v: 1, l: 'Max' }];
const SIZES = [{ v: 0.75, l: 'S' }, { v: 1, l: 'M' }, { v: 1.25, l: 'L' }, { v: 1.5, l: 'XL' }];
const CELL_OPACITIES = [0, 0.1, 0.25, 0.5, 0.75, 1].map((v) => ({ v, l: pct(v) }));

const resetIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground" aria-hidden><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg>
);

/** A colour of the widget's own choosing, from the browser's picker. */
function CustomColour({ label, value, onPick }: { label: string; value: string | undefined; onPick: (hex: string) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <span className="relative">
      <button type="button" onClick={() => ref.current?.click()} className={swatch(false)}
        style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }} title="Custom" aria-label={label} />
      <input ref={ref} type="color" className="sr-only" tabIndex={-1} aria-hidden
        value={value && value.startsWith('#') ? value : '#3B82F6'} onChange={(e) => onPick(e.target.value)} />
    </span>
  );
}

type Target = 'fill' | 'outline' | 'text';
const TARGET_NAMES: Record<Target, string> = { fill: 'fill', outline: 'outline', text: 'text colour' };

export type WidgetStylePanelProps = {
  /** The widget selected on the canvas. */
  widget: WidgetConfig;
  /** The widget as changed, to put in its place in the layout. */
  onChange: (next: WidgetConfig) => void;
  /** Lets the widget go, as a third tap on it does. */
  onClose?: () => void;
  /** See LayoutGridEditorProps: the Hide when empty a widget that has not been set gets where it is drawn. */
  hideEmptyByDefault?: boolean;
  /** Stays / Fades is on the canvas: a calm dashboard's idle screen, which hides an unset empty widget. */
  idleToggles?: boolean;
  /** Every widget on the dashboard, for Apply to all widgets (#1339). Left out, there is no such button. */
  allWidgets?: WidgetConfig[];
  /** The dashboard's widgets with this widget's fill, outline or text on each. */
  onAllChange?: (next: WidgetConfig[]) => void;
  /** A Stays when idle switch (#1350): on a dashboard's widgets, not the photo frame's. */
  staysToggle?: boolean;
};

export function WidgetStylePanel({ widget, onChange, onClose, hideEmptyByDefault = false, idleToggles = false, allWidgets, onAllChange, staysToggle = false }: WidgetStylePanelProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [paletteId, setPaletteId] = useState<PaletteId>('seasonal');
  const palette = getColorPalette(paletteId, isDark);
  const fixedColors = paletteId === 'mono' ? [] : FIXED_COLORS;
  const style = (updates: WidgetStyleUpdate) => onChange(applyWidgetStyle(widget, updates));
  const set = (patch: Partial<WidgetConfig>) => onChange({ ...widget, ...patch });
  const name = WIDGET_REGISTRY[widget.i]?.label ?? widget.i;

  const bgColor = widget.backgroundColor;
  const olColor = widget.outlineColor;
  const bgOpacity = widget.backgroundOpacity ?? 1;
  const olOpacity = widget.outlineOpacity ?? 1;

  // Keys pressed here reach the canvas, as they did when these settings sat
  // on it (#987): the canvas hears keys in its own window, and on the canvas
  // editor this panel is drawn on the editor page, another window.
  const forwardKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.currentTarget.ownerDocument === document) return;
    if (!/^(Arrow(Up|Down|Left|Right)|Delete|Backspace)$/.test(e.key) || isTypingTarget(e.target)) return;
    const copy = new KeyboardEvent('keydown', {
      key: e.key, altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, cancelable: true,
    });
    window.dispatchEvent(copy);
    if (copy.defaultPrevented) e.preventDefault();
  };

  const colours = (target: Target) => {
    const color = target === 'fill' ? bgColor : target === 'outline' ? olColor : widget.textColor;
    const apply = (c: string | null) => style(
      target === 'fill' ? { backgroundColor: c } : target === 'outline' ? { outlineColor: c } : { textColor: c },
    );
    const reset = () => style(
      target === 'fill' ? { backgroundColor: null, backgroundOpacity: 1 }
        : target === 'outline' ? { outlineColor: null, outlineOpacity: 1 }
          : { textColor: null, textOpacity: 1 },
    );
    const what = TARGET_NAMES[target];
    return (
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`${name}'s ${what}`} data-swatches={target}>
        <button type="button" onClick={reset} aria-pressed={!color} className={swatch(!color)} title="Default" aria-label={`Default ${what}`}>
          <span className="flex h-full w-full items-center justify-center bg-card/85">{resetIcon}</span>
        </button>
        {/* Transparent (fill), or None (outline: hides the card's own border too). */}
        {target !== 'text' && (
          <button type="button" onClick={() => apply('transparent')} aria-pressed={color === 'transparent'} className={swatch(color === 'transparent')}
            title={target === 'outline' ? 'None' : 'Transparent'} aria-label={target === 'outline' ? 'No outline' : 'Transparent fill'}>
            <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden><pattern id={`chk-${target}`} width="8" height="8" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="#ccc" /><rect x="4" y="4" width="4" height="4" fill="#ccc" /><rect x="4" width="4" height="4" fill="#fff" /><rect y="4" width="4" height="4" fill="#fff" /></pattern><circle cx="16" cy="16" r="16" fill={`url(#chk-${target})`} /></svg>
          </button>
        )}
        {target === 'fill' && (
          <button type="button" onClick={() => apply('frosted')} aria-pressed={bgColor === 'frosted'} className={swatch(bgColor === 'frosted')}
            title="Frosted glass" aria-label="Frosted fill">
            <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden><defs><radialGradient id="frost-panel" cx="30%" cy="30%"><stop offset="0%" stopColor="rgba(255,255,255,0.7)" /><stop offset="100%" stopColor="rgba(200,210,230,0.4)" /></radialGradient></defs><circle cx="16" cy="16" r="16" fill="url(#frost-panel)" /><circle cx="10" cy="12" r="4" fill="rgba(255,255,255,0.3)" /><circle cx="20" cy="18" r="3" fill="rgba(255,255,255,0.2)" /></svg>
          </button>
        )}
        {/* Glass: the theme's card colour, see-through, blurred. */}
        {target === 'fill' && (
          <button type="button" onClick={() => apply('glass')} aria-pressed={bgColor === 'glass'} className={swatch(bgColor === 'glass')}
            title="Glass" aria-label="Glass fill">
            <span className="block h-full w-full bg-card/80 backdrop-blur-sm" style={{ backgroundImage: 'linear-gradient(135deg, hsl(var(--card) / 0.9), hsl(var(--card) / 0.5))' }} />
          </button>
        )}
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden />
        {[...palette.colors, ...fixedColors].map((hex, n) => (
          <button key={`${hex}-${n}`} type="button" onClick={() => apply(hex)} aria-pressed={color === hex} className={swatch(color === hex)}
            style={{ backgroundColor: hex }} title={hex} aria-label={`${what} ${hex}`} />
        ))}
        <CustomColour label={`Custom ${what}`} value={color} onPick={apply} />
      </div>
    );
  };

  // Apply to all widgets (#1339): this widget's fill, outline or text on
  // every widget, hidden ones too. Says how many of the others differ, and
  // that they all match once they do.
  const applyToAll = (part: LookPart) => {
    if (!allWidgets || !onAllChange || allWidgets.length < 2) return null;
    const what = part === 'text' ? 'text colour and size' : TARGET_NAMES[part];
    const differ = countDiffering(allWidgets, widget, part);
    return (
      <div className="flex flex-col gap-1" data-apply-all={part}>
        <button type="button" disabled={differ === 0} className={cn(chip(false), 'self-start disabled:cursor-default disabled:opacity-50')}
          onClick={() => onAllChange(applyLookToAll(allWidgets, widget, part))}
          aria-label={`Apply this ${what} to all widgets`}>
          Apply to all widgets
        </button>
        <p className={note} data-apply-all-note>
          {differ === 0 ? `Every widget has this ${what}.`
            : `${differ} ${differ === 1 ? 'widget has' : 'widgets have'} a different ${what}.`}
        </p>
      </div>
    );
  };

  const align = (() => {
    if (widget.i !== 'clock' && widget.i !== 'weather') return null;
    // Auto lines up by where the tile sits (#988).
    const current = (widget.settings?.align as { x?: string; y?: string } | undefined) ?? {};
    const setAlign = (axis: 'x' | 'y', value: string) => set({ settings: { ...(widget.settings ?? {}), align: { ...current, [axis]: value } } });
    const row = (label: string, axis: 'x' | 'y', options: Array<[string, string]>) => (
      <Row name={label} label={`Align ${label === 'Across' ? 'across' : 'up and down'}`} data-align-axis={axis}>
        {options.map(([value, text]) => (
          <button key={value} type="button" onClick={() => setAlign(axis, value)} aria-pressed={(current[axis] ?? 'auto') === value}
            className={chip((current[axis] ?? 'auto') === value)} data-align={value}>{text}</button>
        ))}
      </Row>
    );
    return (
      <>
        {row('Across', 'x', [['auto', 'Auto'], ['left', 'Left'], ['center', 'Centre'], ['right', 'Right']])}
        {row('Up/down', 'y', [['auto', 'Auto'], ['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']])}
      </>
    );
  })();

  const grid = WIDGET_REGISTRY[widget.i]?.hasGrid === true && (() => {
    const lineOpacity = widget.gridLineOpacity ?? 1;
    const cellColor = widget.cellBackgroundColor;
    return (
      <section data-widget-style="grid">
        <h3 className={section}>Grid</h3>
        <div className="flex flex-col gap-3">
          <Choices name="Lines" label="Grid line opacity" value={lineOpacity} options={OPACITIES} onPick={(o) => style({ gridLineOpacity: o })} />
          <Row name="Cells" label="Cell background">
            <button type="button" onClick={() => style({ cellBackgroundColor: null, cellBackgroundOpacity: 1 })} aria-pressed={!cellColor}
              className={swatch(!cellColor)} title="Default" aria-label="Default cell background">
              <span className="flex h-full w-full items-center justify-center bg-card/85">{resetIcon}</span>
            </button>
            {palette.colors.slice(0, 6).map((hex) => (
              <button key={hex} type="button" onClick={() => style({ cellBackgroundColor: hex })} aria-pressed={cellColor === hex}
                className={swatch(cellColor === hex)} style={{ backgroundColor: hex }} title={hex} aria-label={`cell background ${hex}`} />
            ))}
          </Row>
          {cellColor && (
            <Choices name="Opacity" label="Cell background opacity" value={widget.cellBackgroundOpacity ?? 1} options={CELL_OPACITIES}
              onPick={(o) => style({ cellBackgroundOpacity: o })} />
          )}
        </div>
      </section>
    );
  })();

  // Hide when empty (#738), for widgets that have an empty state. Stores the
  // choice even when it matches the default, like Stays / Fades, so a later
  // change to the default leaves it be.
  const hideEmpty = canHideWhenEmpty(widget.i) && (() => {
    const on = hidesWhenEmpty(widget, hideEmptyByDefault);
    // A calm dashboard's idle screen hides empty widgets by default, so an
    // unset widget there is hidden only while idle. Say so.
    const idleOnly = idleToggles && widget.hideWhenEmpty === undefined;
    return (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={() => set({ hideWhenEmpty: !on })} aria-pressed={on} className={cn(chip(on), 'self-start')} data-hide-when-empty>
          <EyeOff className="h-4 w-4" aria-hidden />
          {idleOnly ? 'Hide when empty: idle only' : 'Hide when empty'}
        </button>
        <p className={note}>
          {on ? 'Hidden while it has nothing to show.'
            : idleOnly ? 'Hidden while it has nothing to show, only when the screen is idle.'
              : 'Shown even when it has nothing to show.'}
        </p>
      </div>
    );
  })();

  // Hide first on a small screen (#803): left out below about 75% of the
  // design size, and the rows and columns only it used close up.
  const smallOn = widget.hideOnSmallScreen === true;

  return (
    <div className="flex flex-col gap-5" onKeyDown={forwardKeys} data-widget-settings={widget.i}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-title font-medium" style={{ fontFamily: 'var(--font-display)' }}>{name}</h3>
        {onClose && (
          <button type="button" onClick={onClose} className={iconButton} aria-label={`Close ${name}'s settings`} title="Let the widget go">
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      <section>
        <h3 className={section}>Colours</h3>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colour set">
          {PALETTE_ORDER.map((id) => (
            <button key={id} type="button" aria-pressed={paletteId === id} className={chip(paletteId === id)} onClick={() => setPaletteId(id)}>
              {getColorPalette(id, isDark).label}
            </button>
          ))}
        </div>
      </section>

      <section data-widget-style="fill">
        <h3 className={section}>Fill</h3>
        <div className="flex flex-col gap-3">
          {colours('fill')}
          <p className={note} data-fill-name>{fillName(bgColor)}</p>
          {bgColor === 'frosted' ? (
            <Choices name="Blur" label="Fill blur" value={bgOpacity} options={BLURS} onPick={(o) => style({ backgroundOpacity: o })} />
          ) : bgColor && bgColor !== 'transparent' ? (
            <Choices name="Opacity" label="Fill opacity" value={bgOpacity} options={OPACITIES} onPick={(o) => style({ backgroundOpacity: o })} />
          ) : null}
          {applyToAll('fill')}
        </div>
      </section>

      <section data-widget-style="outline">
        <h3 className={section}>Outline</h3>
        <div className="flex flex-col gap-3">
          {colours('outline')}
          {olColor && olColor !== 'transparent' && (
            <Choices name="Opacity" label="Outline opacity" value={olOpacity} options={OPACITIES} onPick={(o) => style({ outlineOpacity: o })} />
          )}
          {applyToAll('outline')}
        </div>
      </section>

      <section data-widget-style="text">
        <h3 className={section}>Text</h3>
        <div className="flex flex-col gap-3">
          {colours('text')}
          <Choices name="Size" label="Text size" value={widget.textScale ?? 1} options={SIZES} onPick={(v) => style({ textScale: v })} />
          {align}
          {applyToAll('text')}
        </div>
      </section>

      {grid}

      <section data-widget-style="showing">
        <h3 className={section}>When it shows</h3>
        <div className="flex flex-col gap-3">
          {staysToggle && (
            // Whether it stays when the screen is idle as the dashboard, quieter (#1350).
            <div className="flex flex-col gap-1">
              {/* A chip, as its neighbours are, so it is as big a target as they are. */}
              <button type="button" role="switch" aria-checked={shownWhenIdle(widget)} onClick={() => set({ showWhenIdle: !shownWhenIdle(widget) })}
                className={cn(chip(shownWhenIdle(widget)), 'self-start')} data-stays-when-idle>
                <Moon className="h-4 w-4" aria-hidden />
                Stays when idle
              </button>
              <p className={note}>
                {shownWhenIdle(widget) ? 'Stays on the dashboard, quieter, when the screen is idle.' : 'Fades when the screen is idle.'}
              </p>
            </div>
          )}
          {hideEmpty}
          <div className="flex flex-col gap-1">
            <button type="button" onClick={() => set({ hideOnSmallScreen: !smallOn })} aria-pressed={smallOn} className={cn(chip(smallOn), 'self-start')} data-hide-small-screen>
              <Minimize2 className="h-4 w-4" aria-hidden />
              Hide first on a small screen
            </button>
            <p className={note}>
              {smallOn ? 'Left out on a small screen, so the rest have room.' : 'Shown on every size of screen.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
