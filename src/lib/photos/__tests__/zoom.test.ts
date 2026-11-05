import { zoomFor, zoomOn, zoomOrigin, ZOOM } from '../zoom';

describe('the slow zoom (#955)', () => {
  it('alternates in and out, with the agreed ends', () => {
    expect(zoomFor(0)).toEqual([1.03, 1.12]);
    expect(zoomFor(1)).toEqual([1.12, 1.04]);
    expect(zoomFor(2)).toBe(ZOOM.in);
  });

  it('runs only at the full level and without reduced motion', () => {
    expect(zoomOn('full', false)).toBe(true);
    expect(zoomOn('full', true)).toBe(false);
    expect(zoomOn('reduced', false)).toBe(false);
    expect(zoomOn('minimal', false)).toBe(false);
  });

  it('anchors on the focal point', () => {
    expect(zoomOrigin({ x: 0.25, y: 0.8 })).toBe('25.0% 80.0%');
  });
});
