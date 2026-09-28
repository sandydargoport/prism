/**
 * VTODO DUE values become a task due in the household zone.
 *
 * DUE;VALUE=DATE used to go through toJSDate(), which is midnight in the
 * server's zone: a day early for a household west of a UTC server. The
 * household zone is passed in, so these hold in any process zone; `npm run
 * test:tz` (and CI) repeats the suite in zones on both sides of UTC anyway.
 */

const mockFetchCalendarObjects = jest.fn();
jest.mock('tsdav', () => ({
  createDAVClient: jest.fn(async () => ({
    fetchCalendars: async () => [{ url: 'https://dav.example.com/cal/' }],
    fetchCalendarObjects: (...a: unknown[]) => mockFetchCalendarObjects(...a),
  })),
}));

import { fetchCalDAVTasks } from '../caldav';

const CAL = 'https://dav.example.com/cal/';

function vtodo(dueLine: string): { data: string; url: string; etag: string } {
  return {
    url: `${CAL}1.ics`,
    etag: '"1"',
    data: [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VTODO',
      'UID:todo-1',
      'SUMMARY:Return library books',
      dueLine,
      'END:VTODO',
      'END:VCALENDAR',
    ].join('\r\n'),
  };
}

async function dueOf(dueLine: string, timeZone: string) {
  mockFetchCalendarObjects.mockResolvedValueOnce([vtodo(dueLine)]);
  const [task] = await fetchCalDAVTasks('https://dav.example.com', 'u', 'p', CAL, timeZone);
  return { dueDate: task!.dueDate, dueTime: task!.dueTime };
}

describe('CalDAV VTODO due', () => {
  beforeEach(() => mockFetchCalendarObjects.mockReset());

  it.each(['America/Chicago', 'Asia/Tokyo', 'UTC'])('keeps a DATE due as its date in %s', async (zone) => {
    await expect(dueOf('DUE;VALUE=DATE:20260928', zone)).resolves.toEqual({
      dueDate: '2026-09-28',
      dueTime: null,
    });
  });

  it('converts a UTC due to the household wall clock', async () => {
    await expect(dueOf('DUE:20260929T013000Z', 'America/Chicago')).resolves.toEqual({
      dueDate: '2026-09-28',
      dueTime: '20:30',
    });
  });

  it('converts a due in a named zone to the household wall clock', async () => {
    await expect(dueOf('DUE;TZID=Europe/Berlin:20260928T090000', 'America/Chicago')).resolves.toEqual({
      dueDate: '2026-09-28',
      dueTime: '02:00',
    });
  });

  it('keeps a floating due as the wall time written', async () => {
    await expect(dueOf('DUE:20260928T170000', 'Asia/Tokyo')).resolves.toEqual({
      dueDate: '2026-09-28',
      dueTime: '17:00',
    });
  });

  it('has no due when DUE is absent', async () => {
    mockFetchCalendarObjects.mockResolvedValueOnce([
      { ...vtodo('DESCRIPTION:none'), url: `${CAL}2.ics` },
    ]);
    const [task] = await fetchCalDAVTasks('https://dav.example.com', 'u', 'p', CAL, 'UTC');
    expect(task).toMatchObject({ dueDate: null, dueTime: null });
  });
});
