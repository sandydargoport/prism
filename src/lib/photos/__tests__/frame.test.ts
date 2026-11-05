import { photoFrame, CENTRED } from '../frame';

const screen = { width: 1920, height: 1080 };
/** Is the subject's spot on screen inside a rect? */
const inside = (o: { x: number; y: number }, r: { left: number; top: number; width: number; height: number }) =>
  o.x * 1920 >= r.left && o.x * 1920 <= r.left + r.width && o.y * 1080 >= r.top && o.y * 1080 <= r.top + r.height;

describe('photoFrame (#957)', () => {
  it('keeps the centred crop when the subject is already clear', () => {
    const f = photoFrame({ aspect: 2, screen, covered: [], focal: { x: 0.5, y: 0.5 } });
    expect(f.position).toEqual({ x: 50, y: 50 });
    expect(f.origin.x).toBeCloseTo(0.5);
  });

  it('moves a wide photo so a subject on its left lands clear of widgets on the left', () => {
    const widgets = [{ left: 0, top: 0, width: 900, height: 1080 }];
    // Centred, this subject lands at x=700, under them; the crop can move it to 1037.
    const f = photoFrame({ aspect: 2.4, screen, covered: widgets, focal: { x: 0.4, y: 0.5 } });
    expect(inside(f.origin, widgets[0]!)).toBe(false);
    // The subject was under the widgets in the centred crop; now it is to their right.
    expect(f.origin.x * 1920).toBeGreaterThan(900);
  });

  it('when nothing keeps it clear, brings the subject as near to a clear spot as the crop allows', () => {
    // A photo the screen's shape cannot be moved at all.
    const widgets = [{ left: 0, top: 0, width: 1000, height: 1080 }];
    const f = photoFrame({ aspect: 16 / 9, screen, covered: widgets, focal: { x: 0.2, y: 0.5 } });
    expect(f.origin.x).toBeCloseTo(0.2, 2);
    // A wide photo moves it as far right as the crop allows.
    const g = photoFrame({ aspect: 2, screen, covered: [{ left: 0, top: 0, width: 1700, height: 1080 }], focal: { x: 0.1, y: 0.5 } });
    expect(g.position.x).toBe(0);
  });

  it('places a tall photo by height the same way', () => {
    const widgets = [{ left: 0, top: 700, width: 1920, height: 380 }];
    const f = photoFrame({ aspect: 0.75, screen, covered: widgets, focal: { x: 0.5, y: 0.8 } });
    expect(f.origin.y * 1080).toBeLessThan(700);
    expect(f.origin.y).toBeGreaterThanOrEqual(0);
  });

  it('falls back to the centre without a usable shape', () => {
    expect(photoFrame({ aspect: 0, screen, covered: [], focal: { x: 0.2, y: 0.2 } })).toEqual(CENTRED);
  });
});
