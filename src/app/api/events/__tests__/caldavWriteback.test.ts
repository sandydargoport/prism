/**
 * Editing a CalDAV event from Prism writes it back to the server (#687).
 *
 * Before, a CalDAV edit changed the Prism copy only and the next sync put the
 * server's copy back. Now the edit goes upstream through pushCalDAVEventUpdate
 * (which keeps everything else on the event, see caldav-write.test.ts), and
 * only what Prism cannot write keeps the "saved here only" warning.
 */
const mockRequireAuth = jest.fn();
const mockSelectWhere = jest.fn();
const mockJoinWhere = jest.fn();
const mockUpdateSet = jest.fn();
const mockPushUpdate = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: jest.requireActual('@/lib/auth/requireAuth').requireRole,
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (...a: unknown[]) => mockSelectWhere(...a),
        leftJoin: () => ({ where: (...a: unknown[]) => mockJoinWhere(...a) }),
      }),
    }),
    update: () => ({
      set: (v: unknown) => {
        mockUpdateSet(v);
        return { where: async () => undefined };
      },
    }),
  },
}));
jest.mock('@/lib/services/calendar-sync', () => ({
  pushCalDAVEventUpdate: (...a: unknown[]) => mockPushUpdate(...a),
  pushCalDAVEventDelete: jest.fn(),
}));
jest.mock('@/lib/integrations/google-calendar', () => ({}));
jest.mock('@/lib/householdTimezone', () => ({ getHouseholdTimezone: async () => 'America/Chicago' }));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { NextRequest } from 'next/server';
import { PATCH } from '../[id]/route';

const CAL_ID = '6f1c2a3e-0b4d-4e8f-9a7b-1c2d3e4f5a6b';
const SOURCE = { id: CAL_ID, provider: 'caldav' };

type Row = {
  id: string;
  createdBy: string | null;
  externalEventId: string;
  calendarSourceId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  recurring: boolean;
  seriesKey: string | null;
  caldavHref: string | null;
};

const ONE_OFF: Row = {
  id: 'e1',
  createdBy: null,
  externalEventId: 'dentist@example.com',
  calendarSourceId: CAL_ID,
  title: 'Dentist',
  description: 'Bring the insurance card',
  location: null,
  startTime: new Date('2026-11-10T15:00:00Z'),
  endTime: new Date('2026-11-10T16:00:00Z'),
  allDay: false,
  recurring: false,
  seriesKey: null,
  caldavHref: 'https://dav.example.com/cal/dentist.ics',
};

// An occurrence of a weekly series that has its own title (an edited
// occurrence on the server), so it differs from the series' title.
const OCCURRENCE: Row = {
  ...ONE_OFF,
  externalEventId: 'swim@example.com_2026-11-10T23:00:00.000Z',
  title: 'Swim practice (late lane)',
  description: null,
  startTime: new Date('2026-11-10T23:00:00Z'),
  endTime: new Date('2026-11-11T00:00:00Z'),
  recurring: true,
  seriesKey: 'swim@example.com',
  caldavHref: 'https://dav.example.com/cal/swim.ics',
};

/** What the event form sends: every field, edited or not. */
function formBody(row: Row, edits: Record<string, unknown> = {}) {
  return {
    title: row.title,
    description: row.description,
    location: row.location,
    startTime: row.startTime.toISOString(),
    endTime: row.endTime.toISOString(),
    allDay: row.allDay,
    recurring: false,
    recurrenceRule: null,
    reminderMinutes: null,
    calendarSourceId: row.calendarSourceId,
    color: null,
    ...edits,
  };
}

function setup(row: Row, source: Record<string, unknown> = SOURCE) {
  mockSelectWhere.mockImplementation(async () => (mockSelectWhere.mock.calls.length === 1 ? [row] : [source]));
  mockJoinWhere.mockResolvedValue([{
    ...row,
    recurrenceRule: null,
    color: null,
    reminderMinutes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    calendarSourceId: source.id,
    calendarSourceName: 'Family',
    calendarSourceColor: '#336699',
    calendarSourceProvider: source.provider,
  }]);
}

async function patch(body: Record<string, unknown>) {
  const res = await PATCH(
    new NextRequest('http://localhost/api/events/e1', { method: 'PATCH', body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: 'e1' }) },
  );
  return { status: res.status, json: await res.json() };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockPushUpdate.mockResolvedValue({ ok: true, etag: '"v2"' });
});

describe('PATCH /api/events/[id] on a CalDAV calendar', () => {
  it('writes the edited title upstream, alone, and stores the new ETag', async () => {
    setup(ONE_OFF);
    const { status, json } = await patch(formBody(ONE_OFF, { title: 'Dentist (room 4)' }));

    expect(status).toBe(200);
    expect(json.warning).toBeUndefined();
    expect(mockPushUpdate).toHaveBeenCalledWith(
      CAL_ID, ONE_OFF.caldavHref, 'dentist@example.com', { title: 'Dentist (room 4)' },
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ title: 'Dentist (room 4)', caldavEtag: '"v2"' }));
  });

  it('writes a moved time with the all-day flag', async () => {
    setup(ONE_OFF);
    await patch(formBody(ONE_OFF, { startTime: '2026-11-10T17:30:00.000Z', endTime: '2026-11-10T18:30:00.000Z' }));
    expect(mockPushUpdate).toHaveBeenCalledWith(CAL_ID, ONE_OFF.caldavHref, 'dentist@example.com', {
      times: {
        startTime: new Date('2026-11-10T17:30:00Z'),
        endTime: new Date('2026-11-10T18:30:00Z'),
        allDay: false,
      },
    });
  });

  it('sends a cleared description as null', async () => {
    setup(ONE_OFF);
    await patch(formBody(ONE_OFF, { description: null }));
    expect(mockPushUpdate.mock.calls[0]![3]).toEqual({ description: null });
  });

  it('saves locally with the read-only warning when the server refuses (403)', async () => {
    setup(ONE_OFF);
    mockPushUpdate.mockResolvedValue({ ok: false, reason: 'forbidden', message: 'CalDAV update failed: 403' });
    const { status, json } = await patch(formBody(ONE_OFF, { title: 'Dentist (room 4)' }));

    expect(status).toBe(200);
    expect(json.warning).toMatch(/cannot write to this calendar/);
    expect(mockUpdateSet).toHaveBeenCalled();
  });

  it('refuses the save on a conflict and leaves the Prism copy unchanged', async () => {
    setup(ONE_OFF);
    mockPushUpdate.mockResolvedValue({ ok: false, reason: 'conflict', message: 'changed' });
    const { status, json } = await patch(formBody(ONE_OFF, { title: 'Dentist (room 4)' }));

    expect(status).toBe(409);
    expect(json.error).toMatch(/changed in another app/);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('refuses the save when the server cannot be updated', async () => {
    setup(ONE_OFF);
    mockPushUpdate.mockResolvedValue({ ok: false, reason: 'error', message: 'CalDAV update failed: 500' });
    const { status } = await patch(formBody(ONE_OFF, { title: 'Dentist (room 4)' }));

    expect(status).toBe(502);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('does not write upstream when nothing was edited', async () => {
    setup(ONE_OFF);
    const { status, json } = await patch(formBody(ONE_OFF));
    expect(status).toBe(200);
    expect(json.warning).toBeUndefined();
    expect(mockPushUpdate).not.toHaveBeenCalled();
  });

  describe('an occurrence of a repeating event', () => {
    it('sends a title edit to the series by its UID', async () => {
      setup(OCCURRENCE);
      const { json } = await patch(formBody(OCCURRENCE, { title: 'Swim' }));
      expect(mockPushUpdate).toHaveBeenCalledWith(CAL_ID, OCCURRENCE.caldavHref, 'swim@example.com', { title: 'Swim' });
      expect(json.warning).toBeUndefined();
    });

    it('keeps a time change local with a warning, and does not push its own title to the series', async () => {
      setup(OCCURRENCE);
      const { status, json } = await patch(formBody(OCCURRENCE, {
        startTime: '2026-11-11T00:00:00.000Z',
        endTime: '2026-11-11T01:00:00.000Z',
      }));

      expect(status).toBe(200);
      expect(mockPushUpdate).not.toHaveBeenCalled();
      expect(json.warning).toMatch(/new time is saved here only/);
    });

    it('writes the title and warns about the time when both change', async () => {
      setup(OCCURRENCE);
      const { json } = await patch(formBody(OCCURRENCE, {
        title: 'Swim',
        startTime: '2026-11-11T00:00:00.000Z',
        endTime: '2026-11-11T01:00:00.000Z',
      }));
      expect(mockPushUpdate.mock.calls[0]![3]).toEqual({ title: 'Swim' });
      expect(json.warning).toMatch(/new time is saved here only/);
    });
  });

  it('keeps the warning for an event synced before hrefs were stored', async () => {
    setup({ ...ONE_OFF, caldavHref: null });
    const { json } = await patch(formBody(ONE_OFF, { title: 'Dentist (room 4)' }));
    expect(mockPushUpdate).not.toHaveBeenCalled();
    expect(json.warning).toMatch(/cannot write to this calendar/);
  });

  it('keeps the warning for an iCal feed', async () => {
    setup(ONE_OFF, { id: CAL_ID, provider: 'ical' });
    const { json } = await patch(formBody(ONE_OFF, { title: 'Dentist (room 4)' }));
    expect(mockPushUpdate).not.toHaveBeenCalled();
    expect(json.warning).toMatch(/cannot write to this calendar/);
  });
});
