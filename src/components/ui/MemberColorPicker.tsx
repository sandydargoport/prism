'use client';

/**
 * Colour picker for a family member: the preset palette plus a custom colour.
 *
 * Swatches already used by another member show that member's initial, so a
 * large family can see what is left. Taken colours stay selectable; sharing a
 * colour is allowed, just harder to tell apart.
 *
 * The custom swatch is a native `<input type="color">` laid over the swatch,
 * so a tap opens the platform's own picker (the touch-friendly one on tablets).
 * Every value is checked with `isHexColor` before it reaches state, and the
 * server applies the same rule.
 */

import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { contrastText } from '@/lib/utils/color';
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

const RAINBOW =
  'conic-gradient(#EF4444, #F59E0B, #84CC16, #10B981, #06B6D4, #3B82F6, #8B5CF6, #EC4899, #EF4444)';

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
  const isCustom = isHexColor(value) && !findMemberColorOption(value);
  const takenBy = (color: string) => taken.find((t) => sameColor(t.color, color));

  const customTakenBy = isCustom ? takenBy(value) : undefined;
  const tooLight = isCustom && isTooLightForWhiteText(value);
  const tooDark = isCustom && isTooDarkForDarkTheme(value);

  const swatchBase =
    'relative h-8 w-8 rounded-full shrink-0 flex items-center justify-center transition-transform';
  const selectedRing = 'ring-2 ring-foreground ring-offset-2 ring-offset-background scale-110';

  return (
    <div className={className}>
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Color">
        {MEMBER_COLOR_OPTIONS.map((option) => {
          const selected = sameColor(value, option.value);
          const owner = takenBy(option.value);
          const label = owner ? `${option.name}, used by ${owner.name}` : option.name;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(swatchBase, selected && selectedRing)}
              style={{ backgroundColor: option.value, color: contrastText(option.value) }}
              aria-label={label}
              aria-pressed={selected}
              title={label}
            >
              {selected ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : owner ? (
                <span className="text-[11px] font-semibold leading-none" aria-hidden>
                  {owner.name.trim().charAt(0).toUpperCase()}
                </span>
              ) : null}
            </button>
          );
        })}

        <div
          className={cn(swatchBase, 'border border-border', isCustom && selectedRing)}
          style={
            isCustom
              ? { backgroundColor: value, color: contrastText(value) }
              : { backgroundImage: RAINBOW, color: '#ffffff' }
          }
          title={isCustom ? `Custom color ${value.toUpperCase()}` : 'Custom color'}
        >
          {isCustom ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/40">
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          <input
            type="color"
            aria-label={isCustom ? `Custom color ${value.toUpperCase()}` : 'Custom color'}
            className="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0"
            value={isHexColor(value) ? value.toLowerCase() : '#000000'}
            onChange={(e) => {
              const next = e.target.value;
              if (isHexColor(next)) onChange(next.toUpperCase());
            }}
          />
        </div>
      </div>

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
