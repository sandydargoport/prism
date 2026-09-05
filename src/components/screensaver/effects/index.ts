import type { ScreensaverEffect } from './types';
import { fade } from './fade';
import { smoke } from './smoke';
import { liquid } from './liquid';
import { fireworks } from './fireworks';

export type { ScreensaverEffect, EffectFrame, EffectPhase } from './types';
export { rasterize, warmRasterCache } from './rasterize';

/** 'off' is not an effect — it means show every widget, and transition nothing. */
export const EFFECTS: Record<string, ScreensaverEffect> = {
  fade, smoke, liquid, fireworks,
};

export const EFFECT_ORDER = ['fade', 'smoke', 'liquid', 'fireworks'] as const;

export function getEffect(id: string): ScreensaverEffect | null {
  return EFFECTS[id] ?? null;
}
