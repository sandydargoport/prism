import { captionSpot, captionText, datePhrase } from '../caption';

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
    expect(captionSpot(screen, [])).toBe('bottom-right');
    const bottomRight = { left: 1500, top: 900, width: 420, height: 180 };
    expect(captionSpot(screen, [bottomRight])).toBe('bottom-left');
    const bottomLeft = { left: 0, top: 900, width: 900, height: 180 };
    expect(captionSpot(screen, [bottomRight, bottomLeft])).toBe('top-centre');
  });

  it('has no spot when every corner is taken, so the line hides', () => {
    expect(captionSpot({ width: 1920, height: 1080 }, [{ left: 0, top: 0, width: 1920, height: 1080 }])).toBeNull();
  });
});
