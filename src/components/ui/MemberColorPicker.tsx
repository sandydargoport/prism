'use client';

/**
 * Colour picker for a family member: the preset palette plus a custom colour.
 *
 * Every colour another member already uses shows that member's initial, preset
 * or custom, so a large family can see what is left. Taken colours stay
 * selectable; sharing a colour is allowed, just harder to tell apart.
 *
 * The custom colour is picked in a panel inside the picker, not the browser's
 * `<input type="color">`. That popup has no OK button and lives outside the
 * page, so the tap that dismisses it lands on the dialog's backdrop and closes
 * the whole member editor (#640). The panel changes the colour live, so Save
 * keeps what is on screen; Done closes it and Cancel puts the colour back.
 *
 * Every value is checked with `isHexColor` before it reaches state, and the
 * server applies the same rule.
 */

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { contrastText, hexToHslValues, hslToHex } from '@/lib/utils/color';
import {
  MEMBER_COLOR_OPTIONS,
  findMemberColorOption,
  isHexColor,
  isTooDarkForDarkTheme,
  isTooLightForWhiteText,
  sameColor,
} from '@/lib/constants/memberColors';

export type TakenMemberColor = {
  color: string;
  name: string;
};

type Hsl = { h: number; s: number; l: number };

const RAINBOW =
  'conic-gradient(#EF4444, #F59E0B, #84CC16, #10B981, #06B6D4, #3B82F6, #8B5CF6, #EC4899, #EF4444)';
const HUE_TRACK =
  'linear-gradient(to right, #FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000)';

function toHsl(hex: string): Hsl {
  const [h = 0, s = 0, l = 0] = hexToHslValues(hex).match(/\d+(\.\d+)?/g)!.map(Number);
  return { h, s, l };
}

function toHex({ h, s, l }: Hsl): string {
  return hslToHex(`${h} ${s}% ${l}%`).toUpperCase();
}

const initialOf = (name: string) => name.trim().charAt(0).toUpperCase();

export function MemberColorPicker({
  value,
  onChange,
  taken = [],
  className,
}: {
  value: string;
  onChange: (color: string) => void;
  /** Colours other members already use (leave out the member being edited). */
  taken?: readonly TakenMemberColor[];
  className?: string;
}) {
  // The colour when the panel opened, for Cancel. null while it is closed.
  const [openedWith, setOpenedWith] = useState<string | null>(null);
  const [hsl, setHsl] = useState<Hsl>({ h: 210, s: 70, l: 50 });
  const [hexDraft, setHexDraft] = useState('');
  const panelOpen = openedWith !== null;

  const isCustom = isHexColor(value) && !findMemberColorOption(value);
  const takenBy = (color: string) => taken.find((t) => sameColor(t.color, color));

  // Other members' custom colours, once each, so they can be seen and compared
  // the same way taken presets are.
  const otherCustoms = taken.filter(
    (t, i) =>
      isHexColor(t.color) &&
      !findMemberColorOption(t.color) &&
      taken.findIndex((u) => sameColor(u.color, t.color)) === i,
  );
  const customIsAnothers = isCustom && otherCustoms.some((t) => sameColor(t.color, value));

  const customTakenBy = isCustom ? takenBy(value) : undefined;
  const tooLight = isCustom && isTooLightForWhiteText(value);
  const tooDark = isCustom && isTooDarkForDarkTheme(value);

  const swatchBase =
    'relative h-8 w-8 rounded-full shrink-0 flex items-center justify-center transition-transform';
  const selectedRing = 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110';

  const openPanel = () => {
    const start = isHexColor(value) ? value.toUpperCase() : '#3B82F6';
    setOpenedWith(value);
    setHsl(toHsl(start));
    setHexDraft(start);
  };

  const applyHsl = (next: Hsl) => {
    setHsl(next);
    const hex = toHex(next);
    setHexDraft(hex);
    onChange(hex);
  };

  const applyHexDraft = (raw: string) => {
    const typed = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    setHexDraft(raw.toUpperCase());
    if (isHexColor(typed)) {
      setHsl(toHsl(typed));
      onChange(typed.toUpperCase());
    }
  };

  const cancelPanel = () => {
    if (openedWith !== null) onChange(openedWith);
    setOpenedWith(null);
  };

  const swatch = (color: string, label: string, owner: TakenMemberColor | undefined) => {
    const selected = sameColor(value, color);
    return (
      <button
        key={color}
        type="button"
        onClick={() => {
          setOpenedWith(null);
          onChange(color.toUpperCase());
        }}
        className={cn(swatchBase, selected && selectedRing)}
        style={{ backgroundColor: color, color: contrastText(color) }}
        aria-label={owner ? `${label}, used by ${owner.name}` : label}
        aria-pressed={selected}
        title={owner ? `${label}, used by ${owner.name}` : label}
      >
        {selected ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : owner ? (
          <span className="text-[11px] font-semibold leading-none" aria-hidden>
            {initialOf(owner.name)}
          </span>
        ) : null}
      </button>
    );
  };

  const slider = (
    label: string,
    key: keyof Hsl,
    max: number,
    track: string,
  ) => (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="range"
        min={0}
        max={max}
        value={hsl[key]}
        onChange={(e) => applyHsl({ ...hsl, [key]: Number(e.target.value) })}
        className="member-color-slider block h-7 w-full cursor-pointer appearance-none rounded-full"
        style={{ background: track }}
      />
    </label>
  );

  return (
    <div className={className}>
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Color">
        {MEMBER_COLOR_OPTIONS.map((option) =>
          swatch(option.value, option.name, takenBy(option.value)),
        )}
        {otherCustoms.map((t) => swatch(t.color, `Custom color ${t.color.toUpperCase()}`, t))}

        <button
          type="button"
          onClick={() => (panelOpen ? setOpenedWith(null) : openPanel())}
          className={cn(
            swatchBase,
            'border border-border',
            isCustom && !customIsAnothers && selectedRing,
          )}
          style={
            isCustom && !customIsAnothers
              ? { backgroundColor: value, color: contrastText(value) }
              : { backgroundImage: RAINBOW, color: '#ffffff' }
          }
          aria-label={isCustom && !customIsAnothers ? `Custom color ${value.toUpperCase()}` : 'Custom color'}
          aria-expanded={panelOpen}
          title="Pick any color"
        >
          {isCustom && !customIsAnothers ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/40">
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
        </button>
      </div>

      {panelOpen && (
        <div className="mt-3 space-y-3 rounded-lg border border-border bg-muted/40 p-3" role="group" aria-label="Custom color">
          {/* The colour being picked beside everyone else's, so it can be
              judged against the family rather than on its own. */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col items-center gap-1">
              <span
                className="h-10 w-10 rounded-full border border-border"
                style={{ backgroundColor: isHexColor(value) ? value : undefined }}
                data-testid="custom-color-preview"
              />
              <span className="text-[11px] font-medium">This one</span>
            </div>
            {taken.map((t) => (
              <div key={`${t.name}-${t.color}`} className="flex flex-col items-center gap-1">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold"
                  style={{ backgroundColor: t.color, color: contrastText(t.color) }}
                  aria-hidden
                >
                  {initialOf(t.name)}
                </span>
                <span className="max-w-14 truncate text-[11px] text-muted-foreground">{t.name}</span>
              </div>
            ))}
          </div>

          {slider('Hue', 'h', 360, HUE_TRACK)}
          {slider(
            'Richness',
            's',
            100,
            `linear-gradient(to right, ${toHex({ ...hsl, s: 0 })}, ${toHex({ ...hsl, s: 100 })})`,
          )}
          {slider(
            'Lightness',
            'l',
            100,
            `linear-gradient(to right, #000000, ${toHex({ ...hsl, l: 50 })}, #FFFFFF)`,
          )}

          <div className="flex items-end gap-2">
            <label className="block flex-1 space-y-1">
              <span className="text-xs text-muted-foreground">Color code</span>
              <input
                type="text"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={7}
                value={hexDraft}
                onChange={(e) => applyHexDraft(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-mono text-sm"
              />
            </label>
            <button
              type="button"
              onClick={cancelPanel}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setOpenedWith(null)}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {customTakenBy && (
        <p className="text-xs text-muted-foreground mt-1">Also used by {customTakenBy.name}.</p>
      )}
      {tooLight && (
        <p className="text-xs text-muted-foreground mt-1">
          This color is very light, so white text on it (calendar events, initials) will be hard to read.
        </p>
      )}
      {tooDark && (
        <p className="text-xs text-muted-foreground mt-1">
          This color is very dark and will be hard to see on a dark theme.
        </p>
      )}
    </div>
  );
}
