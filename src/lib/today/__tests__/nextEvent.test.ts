import { nextEventToday } from '../nextEvent';

const at = (h: number, m = 0) => new Date(2026, 10, 5, h, m);
const ev = (title: string, start: Date, end: Date, allDay = false) => ({ title, startTime: start, endTime: end, allDay });
const today = () => true;

describe('nextEventToday', () => {
  const now = at(14);

  it('names the next timed event, not one already over', () => {
    const events = [ev('Lunch', at(12), at(13)), ev('Pickup', at(15), at(15, 30)), ev('Dinner', at(18), at(19))];
    expect(nextEventToday(events, now, today)?.title).toBe('Pickup');
  });

  it('names an event under way before a later one', () => {
    const events = [ev('Later', at(16), at(17)), ev('Under way', at(13, 30), at(14, 30))];
    expect(nextEventToday(events, now, today)?.title).toBe('Under way');
  });

  it('falls back to an all-day event when nothing timed is left', () => {
    const events = [ev('Lunch', at(12), at(13)), ev('School holiday', at(0), at(23, 59), true)];
    expect(nextEventToday(events, now, today)?.title).toBe('School holiday');
  });

  it('prefers a timed event to an all-day one', () => {
    const events = [ev('School holiday', at(0), at(23, 59), true), ev('Pickup', at(15), at(16))];
    expect(nextEventToday(events, now, today)?.title).toBe('Pickup');
  });

  it('is empty on a clear day and ignores other days', () => {
    expect(nextEventToday([], now, today)).toBeUndefined();
    expect(nextEventToday([ev('Tomorrow', at(15), at(16))], now, () => false)).toBeUndefined();
  });
});
