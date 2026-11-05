/**
 * @jest-environment jsdom
 *
 * The clock as a lock screen (#800): date above the time, medium-weight
 * tabular digits, seconds small and dimmed, digits that slide in when they
 * change but never on the first paint and never under reduced motion.
 */
import { act, render } from '@testing-library/react';
import { ClockWidget, splitSeconds } from '../ClockWidget';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ timeFormat: '12h', displayTimezone: 'America/Chicago' }),
}));

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-06-17T21:10:23Z') });
});
afterEach(() => jest.useRealTimers());

const face = (props: Parameters<typeof ClockWidget>[0] = {}) => {
  const { container } = render(<ClockWidget {...props} />);
  return {
    container,
    time: container.querySelector('[data-clock-time]') as HTMLElement,
    date: container.querySelector('[data-clock-date]') as HTMLElement,
    digits: () => Array.from(container.querySelectorAll('[data-clock-digit]')) as HTMLElement[],
  };
};

describe('the clock face', () => {
  it('puts the date above the time', () => {
    const { time, date } = face();
    expect(date.compareDocumentPosition(time) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws the time at medium weight in tabular digits of the display face (#800)', () => {
    const { time } = face();
    expect(time.className).toMatch(/\bfont-medium\b/);
    expect(time.className).toMatch(/\btabular-nums\b/);
    expect(time.style.fontFamily).toBe('var(--font-display)');
  });

  it('draws seconds small and dimmed after the minutes', () => {
    const { container, time } = face({ showSeconds: true });
    const seconds = container.querySelector('[data-clock-seconds]') as HTMLElement;
    expect(seconds.textContent).toBe(':23');
    expect(seconds.className).toMatch(/text-\[0\.45em\]/);
    expect(seconds.className).toMatch(/\btext-muted-foreground\b/);
    expect(time.textContent).toBe('4:10:23PM');
  });

  it('has no seconds unless asked', () => {
    const { container } = face();
    expect(container.querySelector('[data-clock-seconds]')).toBeNull();
  });
});

describe('digits that slide in', () => {
  const sliding = (ds: HTMLElement[]) => ds.filter((d) => d.className.includes('animate-digit-in')).map((d) => d.textContent);

  it('does not slide anything on the first paint', () => {
    const { digits } = face({ showSeconds: true });
    expect(digits().length).toBeGreaterThan(0);
    expect(sliding(digits())).toEqual([]);
  });

  it('slides only the digit that changed, with the slide off under reduced motion', () => {
    const { digits } = face({ showSeconds: true });
    act(() => { jest.advanceTimersByTime(1000); }); // 4:10:23 -> 4:10:24
    expect(sliding(digits())).toEqual(['4']);
    const moved = digits().find((d) => d.className.includes('animate-digit-in'))!;
    expect(moved.className).toMatch(/motion-reduce:animate-none/);
  });
});

describe('splitSeconds', () => {
  it('takes the seconds off the end only when they are shown', () => {
    expect(splitSeconds('4:10:23', true)).toEqual({ main: '4:10', seconds: ':23' });
    expect(splitSeconds('16.10.23', true)).toEqual({ main: '16.10', seconds: '.23' });
    expect(splitSeconds('4:10', false)).toEqual({ main: '4:10', seconds: '' });
  });
});
