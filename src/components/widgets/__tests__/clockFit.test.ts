import { clockFit, splitDayHalf } from '../ClockWidget';

describe('splitDayHalf', () => {
  it('takes the day half off either side of the digits', () => {
    expect(splitDayHalf('4:10 PM')).toEqual({ digits: '4:10', dayHalf: 'PM', dayHalfFirst: false });
    expect(splitDayHalf('12:59:59 a.m.')).toEqual({ digits: '12:59:59', dayHalf: 'a.m.', dayHalfFirst: false });
    expect(splitDayHalf('午後4:10')).toEqual({ digits: '4:10', dayHalf: '午後', dayHalfFirst: true });
    expect(splitDayHalf('16:10')).toEqual({ digits: '16:10', dayHalf: '', dayHalfFirst: false });
  });
});

describe('clockFit', () => {
  it('caps the time at the size class and sizes it from the box otherwise', () => {
    expect(clockFit('12h', false, 'medium').time).toBe('min(3rem, 26.3cqw, 45cqh)');
    // A wider face (seconds) gets a smaller share of the width per em.
    const cq = (t: string) => parseFloat(t.split(', ')[1]!);
    expect(cq(clockFit('12h', true, 'medium').time)).toBeLessThan(cq(clockFit('12h', false, 'medium').time));
    expect(cq(clockFit('24h', false, 'medium').time)).toBeGreaterThan(cq(clockFit('12h', false, 'medium').time));
  });

  it('never lets the date drop under the text floor', () => {
    expect(clockFit('12h', false, 'small').date).toMatch(/^max\(calc\(var\(--text-floor\)/);
  });
});
