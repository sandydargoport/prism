import {
  compareTaskDue,
  dueFromInstant,
  isTaskOverdue,
  parseDueTime,
  parseTaskDueInput,
} from '../taskDue';

const CHICAGO = 'America/Chicago';
const TOKYO = 'Asia/Tokyo';

describe('parseDueTime', () => {
  it.each([
    ['09:30', '09:30'],
    ['9:30', '09:30'],
    ['17:05:00', '17:05'],
    ['23:59', '23:59'],
  ])('reads %s as %s', (input, expected) => {
    expect(parseDueTime(input)).toBe(expected);
  });

  it.each(['24:00', '12:60', '9', 'noon', '', null, 930])('rejects %p', (input) => {
    expect(parseDueTime(input)).toBeNull();
  });
});

describe('dueFromInstant', () => {
  it('keeps the date of a UTC-midnight value as written, in every zone', () => {
    const utcMidnight = new Date('2026-09-28T00:00:00.000Z');
    expect(dueFromInstant(utcMidnight, CHICAGO)).toEqual({ dueDate: '2026-09-28', dueTime: null });
    expect(dueFromInstant(utcMidnight, TOKYO)).toEqual({ dueDate: '2026-09-28', dueTime: null });
  });

  it('reads any other instant as the wall date and time in the zone', () => {
    // 01:30 UTC on the 29th is still the evening of the 28th in Chicago.
    const instant = new Date('2026-09-29T01:30:00Z');
    expect(dueFromInstant(instant, CHICAGO)).toEqual({ dueDate: '2026-09-28', dueTime: '20:30' });
    expect(dueFromInstant(instant, TOKYO)).toEqual({ dueDate: '2026-09-29', dueTime: '10:30' });
  });

  it('treats the old 23:59 "no time" value as date-only', () => {
    // 23:59:59 Chicago (CDT) on the 28th, as the old calendar drag wrote it.
    expect(dueFromInstant(new Date('2026-09-29T04:59:59Z'), CHICAGO)).toEqual({
      dueDate: '2026-09-28',
      dueTime: null,
    });
  });
});

describe('parseTaskDueInput', () => {
  it('takes a date key as the date, without a zone', () => {
    expect(parseTaskDueInput({ dueDate: '2026-09-28' }, CHICAGO)).toEqual({
      ok: true,
      due: { dueDate: '2026-09-28' },
    });
  });

  it('returns only the fields the body sets', () => {
    expect(parseTaskDueInput({ dueTime: '08:15' }, CHICAGO)).toEqual({ ok: true, due: { dueTime: '08:15' } });
    expect(parseTaskDueInput({}, CHICAGO)).toEqual({ ok: true, due: {} });
  });

  it('clears the time along with the date', () => {
    expect(parseTaskDueInput({ dueDate: null, dueTime: '08:15' }, CHICAGO)).toEqual({
      ok: true,
      due: { dueDate: null, dueTime: null },
    });
  });

  it('converts an ISO date-time from an older client in the household zone', () => {
    expect(parseTaskDueInput({ dueDate: '2026-09-28T14:00:00.000Z' }, CHICAGO)).toEqual({
      ok: true,
      due: { dueDate: '2026-09-28', dueTime: '09:00' },
    });
  });

  it.each(['2026-02-30', '28/09/2026', '2026-09-28T09:00', 42])('rejects dueDate %p', (dueDate) => {
    expect(parseTaskDueInput({ dueDate }, CHICAGO).ok).toBe(false);
  });

  it('rejects a malformed dueTime', () => {
    expect(parseTaskDueInput({ dueDate: '2026-09-28', dueTime: '25:00' }, CHICAGO).ok).toBe(false);
  });
});

describe('isTaskOverdue', () => {
  // Built from local components, so these hold in any process zone.
  const now = new Date(2026, 8, 28, 15, 0);

  it('does not mark a date-only task overdue on its own day', () => {
    expect(isTaskOverdue({ dueDate: '2026-09-28' }, now)).toBe(false);
    expect(isTaskOverdue({ dueDate: '2026-09-27' }, now)).toBe(true);
  });

  it('marks a timed task overdue once its time has passed', () => {
    expect(isTaskOverdue({ dueDate: '2026-09-28', dueTime: '14:59' }, now)).toBe(true);
    expect(isTaskOverdue({ dueDate: '2026-09-28', dueTime: '15:01' }, now)).toBe(false);
  });

  it('never marks a task with no due', () => {
    expect(isTaskOverdue({}, now)).toBe(false);
  });
});

describe('compareTaskDue', () => {
  it('orders by date, timed before date-only on a day, no due last', () => {
    const tasks = [
      { id: 'none' },
      { id: 'd2', dueDate: '2026-09-29' },
      { id: 'd1', dueDate: '2026-09-28' },
      { id: 'd1-9am', dueDate: '2026-09-28', dueTime: '09:00' },
      { id: 'd1-7am', dueDate: '2026-09-28', dueTime: '07:00' },
    ];
    expect([...tasks].sort(compareTaskDue).map((t) => t.id)).toEqual([
      'd1-7am',
      'd1-9am',
      'd1',
      'd2',
      'none',
    ]);
  });
});

describe('isTaskOverdue in a display zone', () => {
  // 03:30Z on 29 Sep: 22:30 on the 28th in Chicago, 12:30 on the 29th in Tokyo.
  const now = new Date('2026-09-29T03:30:00Z');

  it('judges a date-only task by the display zone\'s date, not the device\'s', () => {
    expect(isTaskOverdue({ dueDate: '2026-09-28' }, now, 'America/Chicago')).toBe(false);
    expect(isTaskOverdue({ dueDate: '2026-09-28' }, now, 'Asia/Tokyo')).toBe(true);
  });

  it('judges a timed task by the display zone\'s wall clock', () => {
    expect(isTaskOverdue({ dueDate: '2026-09-28', dueTime: '22:00' }, now, 'America/Chicago')).toBe(true);
    expect(isTaskOverdue({ dueDate: '2026-09-28', dueTime: '23:00' }, now, 'America/Chicago')).toBe(false);
    expect(isTaskOverdue({ dueDate: '2026-09-29', dueTime: '12:00' }, now, 'Asia/Tokyo')).toBe(true);
    expect(isTaskOverdue({ dueDate: '2026-09-29', dueTime: '13:00' }, now, 'Asia/Tokyo')).toBe(false);
  });

  it('falls back to the device clock for an unknown zone', () => {
    expect(isTaskOverdue({ dueDate: '2000-01-01' }, now, 'Not/AZone')).toBe(true);
  });
});
