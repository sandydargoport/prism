import { orientationFromDimensions } from '../photoOrientation';

describe('orientationFromDimensions', () => {
  it('calls a wider-than-tall photo landscape', () => {
    expect(orientationFromDimensions(4032, 3024)).toBe('landscape');
  });

  it('calls a taller-than-wide photo portrait', () => {
    expect(orientationFromDimensions(3024, 4032)).toBe('portrait');
  });

  it('calls equal dimensions square', () => {
    expect(orientationFromDimensions(1080, 1080)).toBe('square');
  });

  it('returns null when a dimension is missing, rather than guessing square', () => {
    expect(orientationFromDimensions(null, 3024)).toBeNull();
    expect(orientationFromDimensions(4032, null)).toBeNull();
    expect(orientationFromDimensions(undefined, undefined)).toBeNull();
  });

  it('treats zero as a real dimension, not as missing', () => {
    expect(orientationFromDimensions(0, 100)).toBe('portrait');
  });
});
