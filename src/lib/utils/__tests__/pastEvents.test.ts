import { isPastEventsMode, withoutEndedEvents } from '../pastEvents';

const ZONE = 'America/Chicago';

function timed(id: string, start: string, end: string) {
  return { id, startTime: new Date(start), endTime: new Date(end), allDay: false };
}

function allDay(id: string, startDate: string, endDateExclusive: string) {
  return {
    id,
    startTime: new Date(`${startDate}T00:00:00.000Z`),
    endTime: new Date(`${endDateExclusive}T00:00:00.000Z`),
    allDay: true,
  };
}

const ids = (events: Array<{ id: string }>) => events.map((e) => e.id);

describe('withoutEndedEvents', () => {
  // 3:00 PM in Springfield on Tuesday 3 Nov 2026.
  const now = new Date('2026-11-03T21:00:00.000Z');

  it('drops a timed event once its end has passed', () => {
    const events = [timed('morning', '2026-11-03T15:00:00Z', '2026-11-03T16:00:00Z')];
    expect(withoutEndedEvents(events, now, ZONE)).toEqual([]);
  });

  it('keeps an event that has started but not ended', () => {
    // Cut off by start time, a practice running right now would vanish while
    // the family is still at it.
    const events = [timed('practice', '2026-11-03T20:30:00Z', '2026-11-03T22:00:00Z')];
    expect(ids(withoutEndedEvents(events, now, ZONE))).toEqual(['practice']);
  });

  it('drops an event the moment it ends, not a minute later', () => {
    const events = [timed('call', '2026-11-03T20:30:00Z', '2026-11-03T21:00:00Z')];
    expect(withoutEndedEvents(events, now, ZONE)).toEqual([]);
  });

  it('keeps future events', () => {
    const events = [timed('dinner', '2026-11-04T00:00:00Z', '2026-11-04T01:00:00Z')];
    expect(ids(withoutEndedEvents(events, now, ZONE))).toEqual(['dinner']);
  });

  it("keeps today's all-day event for the whole of today", () => {
    const events = [allDay('election-day', '2026-11-03', '2026-11-04')];
    expect(ids(withoutEndedEvents(events, now, ZONE))).toEqual(['election-day']);
  });

  it('reads all-day ends in the household zone, not UTC', () => {
    // 11:30 PM Tuesday in Springfield is already Wednesday in UTC. Read in
    // UTC, Tuesday's all-day event would disappear half an hour early.
    const lateEvening = new Date('2026-11-04T05:30:00.000Z');
    const events = [allDay('election-day', '2026-11-03', '2026-11-04')];
    expect(ids(withoutEndedEvents(events, lateEvening, ZONE))).toEqual(['election-day']);
    expect(withoutEndedEvents(events, new Date('2026-11-04T06:30:00.000Z'), ZONE)).toEqual([]);
  });

  it('keeps a multi-day all-day event until its last day is over', () => {
    const events = [allDay('trip', '2026-11-01', '2026-11-05')];
    expect(ids(withoutEndedEvents(events, now, ZONE))).toEqual(['trip']);
    expect(withoutEndedEvents(events, new Date('2026-11-05T07:00:00.000Z'), ZONE)).toEqual([]);
  });

  it("drops yesterday's all-day event", () => {
    const events = [allDay('yesterday', '2026-11-02', '2026-11-03')];
    expect(withoutEndedEvents(events, now, ZONE)).toEqual([]);
  });
});

describe('isPastEventsMode', () => {
  it.each(['dim', 'hide'])('accepts %p', (value) => {
    expect(isPastEventsMode(value)).toBe(true);
  });

  it.each(['show', '', null, undefined, 1, true])('rejects %p', (value) => {
    expect(isPastEventsMode(value)).toBe(false);
  });
});
