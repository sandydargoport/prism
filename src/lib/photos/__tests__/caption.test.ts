import { captionSpot, captionText, datePhrase, mixOnThisDay } from '../caption';

const now = new Date(2026, 10, 5, 12);

describe('the photo caption (#958)', () => {
  it('says when, as a phrase', () => {
    expect(datePhrase(new Date(2026, 2, 14), now)).toBe('March');
    expect(datePhrase(new Date(2025, 5, 2), now)).toBe('June last year');
    expect(datePhrase(new Date(2019, 5, 2), now)).toBe('June 2019');
    expect(datePhrase(new Date(2021, 10, 5, 9), now)).toBe('On this day, 2021');
  });

  it('says nothing without a usable date', () => {
    expect(datePhrase(null, now)).toBeNull();
    expect(datePhrase('not a date', now)).toBeNull();
    expect(datePhrase(new Date(2027, 0, 1), now)).toBeNull();
  });

  it('joins the date and place, or uses whichever there is', () => {
    expect(captionText('June 2019', 'Springfield, Oregon')).toBe('June 2019, Springfield, Oregon');
    expect(captionText(null, 'Springfield, Oregon')).toBe('Springfield, Oregon');
    expect(captionText('June 2019', null)).toBe('June 2019');
    expect(captionText(null, null)).toBeNull();
  });

  it('takes the first corner no widget uses', () => {
    const screen = { width: 1920, height: 1080 };
    expect(captionSpot(screen, [])).toEqual({ spot: 'bottom-right', lift: 0 });
    const bottomRight = { left: 1500, top: 700, width: 420, height: 380 };
    expect(captionSpot(screen, [bottomRight])).toEqual({ spot: 'bottom-left', lift: 0 });
    const bottomLeft = { left: 0, top: 700, width: 900, height: 380 };
    // Both bottom corners taken: no caption, never the top or bottom centre (#992).
    expect(captionSpot(screen, [bottomRight, bottomLeft])).toBeNull();
  });

  it('lifts the line just clear of a small item already in the corner (#992)', () => {
    const screen = { width: 1920, height: 1080 };
    const button = { left: 1759, top: 994, width: 120, height: 44 };
    const place = captionSpot(screen, [button])!;
    expect(place.spot).toBe('bottom-right');
    // The line's bottom (1080 - 32 - lift) sits at least 8px above the button.
    expect(1080 - 32 - place.lift).toBeLessThanOrEqual(994 - 8);
    expect(place.lift).toBeLessThanOrEqual(0.15 * 1080);
  });

  it('has no spot when every corner is taken, so the line hides', () => {
    expect(captionSpot({ width: 1920, height: 1080 }, [{ left: 0, top: 0, width: 1920, height: 1080 }])).toBeNull();
  });
});

describe('the On this day mix (#959)', () => {
  const p = (id: string) => ({ id });
  it('puts one of them every other photo, in turn', () => {
    expect(mixOnThisDay([p('a'), p('b'), p('c')], [p('x'), p('y')]).map((x) => x.id)).toEqual(['x', 'a', 'y', 'b', 'x', 'c']);
  });
  it('leaves the rotation as it is when there are none', () => {
    expect(mixOnThisDay([p('a'), p('b')], []).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('never doubles a photo that is in both lists', () => {
    expect(mixOnThisDay([p('x'), p('a')], [p('x')]).map((x) => x.id)).toEqual(['x', 'a']);
    expect(mixOnThisDay([p('x')], [p('x')]).map((x) => x.id)).toEqual(['x']);
  });
});
