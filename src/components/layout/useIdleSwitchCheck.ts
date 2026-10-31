'use client';

import { useMemo } from 'react';
import { useNow } from '@/lib/hooks/useNow';
import { useSkyLocation } from '@/components/screensaver/useIdleBackground';
import { firstCrossedNight, tonight, type IdleBackground, type NightSpan } from '@/lib/idleBackground';

export type IdleSwitchCheck = {
  /** Tonight's night, or the one in progress, as the display will switch. */
  night?: NightSpan | null;
  /** The first night in the coming year the offsets would cross; Save is refused. */
  crossed?: Date | null;
  /** No household location is set, so dusk and dawn come from the time zone. */
  guessedLocation?: boolean;
};

/**
 * What the editor shows under a day and night pair, and whether it may be
 * saved: tonight's actual times with the offsets applied, worked out from the
 * household location as the display will, and the first night they cross.
 */
export function useIdleSwitchCheck(bg: IdleBackground | null): IdleSwitchCheck {
  const sw = bg && 'switch' in bg ? bg.switch : null;
  const bySun = sw?.by === 'sun';
  const { lat, lon, guessed } = useSkyLocation(bySun);
  const now = useNow();
  return useMemo(() => {
    if (!sw) return {};
    return {
      night: tonight(now, sw, lat, lon),
      crossed: firstCrossedNight(now, sw, lat, lon),
      guessedLocation: bySun && !!guessed,
    };
  }, [sw, bySun, now, lat, lon, guessed]);
}
