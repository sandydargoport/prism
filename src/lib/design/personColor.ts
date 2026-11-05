/**
 * A person's colour at two strengths (#932): pastel on a photo and in dark,
 * deeper on paper in light. Either way a mark (a dot, a ring, a bar) reaches
 * 3:1 against what it sits on, the contrast a non-text mark needs.
 */
import { contrastRatioHex } from '@/lib/utils/color';

export type PersonGround = 'photo' | 'paper';

/** The grounds a mark is checked against: the warm near-black, and Paper's page. */
export const PERSON_GROUNDS: Record<PersonGround, string> = { photo: '#16110d', paper: '#f7f3ec' };

const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: string, b: string, share: number) => {
  const x = toRgb(a), y = toRgb(b);
  return toHex(x.map((v, i) => v * (1 - share) + y[i]! * share));
};

/** The colour for a mark on this ground, eased toward white or black only as far as it needs. */
export function personColor(color: string, ground: PersonGround): string {
  const base = /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : '#888888';
  const toward = ground === 'photo' ? '#ffffff' : '#000000';
  // Pastel on a photo starts a quarter of the way to white.
  let share = ground === 'photo' ? 0.25 : 0;
  let out = mix(base, toward, share);
  while (contrastRatioHex(out, PERSON_GROUNDS[ground]) < 3 && share < 0.9) {
    share += 0.05;
    out = mix(base, toward, share);
  }
  return out;
}
