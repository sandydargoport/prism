/**
 * Attention notices (#692 phase 2): when each trigger starts and stops
 * showing a card, and the order the cards come in.
 */
import {
  arrangeNotices,
  busNotices,
  eventNotices,
  MAX_NOTICES,
  messageNotices,
  parseAttention,
  serializeAttention,
  type BusTrip,
  type Notice,
} from '../screenAttention';

const MIN = 60 * 1000;
const NOW = Date.parse('2026-11-02T13:00:00Z');
const at = (minutesFromNow: number) => new Date(NOW + minutesFromNow * MIN);

describe('parseAttention / serializeAttention', () => {
  it('is all off when unset or unreadable', () => {
    expect(parseAttention(null)).toEqual({ bus: null, event: null, message: null });
    expect(parseAttention('not json')).toEqual({ bus: null, event: null, message: null });
    expect(parseAttention('[1]')).toEqual({ bus: null, event: null, message: null });
  });

  it('keeps each trigger inside its range', () => {
    expect(parseAttention('{"bus":0,"event":9999,"message":"x"}')).toEqual({ bus: 1, event: 240, message: null });
  });

  it('round-trips, and stores nothing when every trigger is off', () => {
    const on = { bus: 10, event: null, message: 120 };
    expect(parseAttention(serializeAttention(on))).toEqual(on);
    expect(serializeAttention({ bus: null, event: null, message: null })).toBeNull();
  });
});

const trip = (minutesToStop: number | null, passed = false): BusTrip => ({
  id: 'trip-1',
  routeId: 'route-1',
  routeLabel: 'Morning bus',
  riderStop: { name: 'Elm St', projectedAt: minutesToStop === null ? null : at(minutesToStop).toISOString(), passed },
});

describe('busNotices', () => {
  it('shows from N minutes before the bus reaches the stop', () => {
    expect(busNotices([trip(15)], [], NOW, 15)).toHaveLength(1);
    expect(busNotices([trip(15.1)], [], NOW, 15)).toHaveLength(0);
    expect(busNotices([trip(0)], [], NOW, 15)[0]).toMatchObject({ kind: 'bus', title: 'Morning bus', at: NOW });
  });

  it('goes once the bus has passed the stop, or has no estimate', () => {
    expect(busNotices([trip(2, true)], [], NOW, 15)).toHaveLength(0);
    expect(busNotices([trip(null)], [], NOW, 15)).toHaveLength(0);
  });

  it('uses the emailed estimate only for a route with no live trip', () => {
    const estimate = { id: 'route-1', label: 'Morning bus', stopName: 'Elm St', etaMinutes: 5 };
    expect(busNotices([], [estimate], NOW, 15)).toHaveLength(1);
    expect(busNotices([], [{ ...estimate, etaMinutes: 16 }], NOW, 15)).toHaveLength(0);
    expect(busNotices([], [{ ...estimate, etaMinutes: null }], NOW, 15)).toHaveLength(0);
    // The live trip is far off, so nothing; the estimate does not stand in for it.
    expect(busNotices([trip(40)], [estimate], NOW, 15)).toHaveLength(0);
  });
});

describe('eventNotices', () => {
  const event = (minutesToStart: number, allDay = false) =>
    ({ id: 'e1', title: 'Dentist', startTime: at(minutesToStart), allDay });

  it('shows from N minutes before the start until it starts', () => {
    expect(eventNotices([event(15)], NOW, 15)).toHaveLength(1);
    expect(eventNotices([event(16)], NOW, 15)).toHaveLength(0);
    expect(eventNotices([event(0.5)], NOW, 15)).toHaveLength(1);
    expect(eventNotices([event(0)], NOW, 15)).toHaveLength(0);
  });

  it('never for an all-day event', () => {
    expect(eventNotices([event(5, true)], NOW, 15)).toHaveLength(0);
  });
});

describe('messageNotices', () => {
  const message = (minutesAgo: number) =>
    ({ id: 'm1', message: 'Back at 6', createdAt: at(-minutesAgo), author: { name: 'Sam' } });

  it('shows for N minutes after it was posted', () => {
    expect(messageNotices([message(0)], NOW, 120)[0]).toMatchObject({ title: 'Sam: Back at 6' });
    expect(messageNotices([message(119)], NOW, 120)).toHaveLength(1);
    expect(messageNotices([message(120)], NOW, 120)).toHaveLength(0);
  });
});

describe('arrangeNotices', () => {
  const notice = (id: string, since: number): Notice => ({ id, kind: 'message', since, title: id, at: since });

  it('puts the newest on top and leaves out what was dismissed', () => {
    const list = [notice('old', 1), notice('new', 3), notice('mid', 2)];
    expect(arrangeNotices(list, new Set()).map((n) => n.id)).toEqual(['new', 'mid', 'old']);
    expect(arrangeNotices(list, new Set(['mid'])).map((n) => n.id)).toEqual(['new', 'old']);
  });

  it('drops the oldest past the limit', () => {
    const list = Array.from({ length: MAX_NOTICES + 2 }, (_, i) => notice(`n${i}`, i));
    const shown = arrangeNotices(list, new Set());
    expect(shown).toHaveLength(MAX_NOTICES);
    expect(shown[0]!.id).toBe(`n${MAX_NOTICES + 1}`);
  });
});
