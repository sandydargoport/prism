import { computeDedupeKey } from '../photo-sync';

describe('computeDedupeKey', () => {
  it('builds `${iso-to-second}_${w}x${h}` for a complete photo', () => {
    const t = new Date('2026-01-02T03:04:05.000Z');
    expect(computeDedupeKey(t, 4032, 3024)).toBe('2026-01-02T03:04:05.000Z_4032x3024');
  });

  it('truncates sub-second jitter so two copies of one shot match', () => {
    const a = computeDedupeKey(new Date('2026-01-02T03:04:05.123Z'), 4032, 3024);
    const b = computeDedupeKey(new Date('2026-01-02T03:04:05.789Z'), 4032, 3024);
    expect(a).toBe(b);
  });

  it('distinguishes a crop (same time, different dims) from its original', () => {
    const t = new Date('2026-01-02T03:04:05Z');
    const original = computeDedupeKey(t, 4032, 3024);
    const cropped = computeDedupeKey(t, 3000, 3000);
    expect(original).not.toBe(cropped);
  });

  it('returns null when capture time is missing (never deduped)', () => {
    expect(computeDedupeKey(null, 4032, 3024)).toBeNull();
  });

  it('returns null when either dimension is missing', () => {
    const t = new Date('2026-01-02T03:04:05Z');
    expect(computeDedupeKey(t, null, 3024)).toBeNull();
    expect(computeDedupeKey(t, 4032, null)).toBeNull();
  });
});
