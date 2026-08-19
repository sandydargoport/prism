import {
  convertGoogleEventToInternal,
  toGoogleAllDayRange,
  type GoogleCalendarEvent,
} from '../google-calendar';

describe('toGoogleAllDayRange', () => {
  it('advances an inclusive same-day end to Google’s exclusive next day', () => {
    expect(toGoogleAllDayRange(
      new Date('2026-08-19T00:00:00.000Z'),
      new Date('2026-08-19T23:59:59.000Z'),
    )).toEqual({ start: { date: '2026-08-19' }, end: { date: '2026-08-20' } });
  });

  it('preserves an end that is already an exclusive midnight boundary', () => {
    expect(toGoogleAllDayRange(
      new Date('2026-08-19T00:00:00.000Z'),
      new Date('2026-08-20T00:00:00.000Z'),
    )).toEqual({ start: { date: '2026-08-19' }, end: { date: '2026-08-20' } });
  });

  it('uses an exclusive day after the inclusive end for multi-day events', () => {
    expect(toGoogleAllDayRange(
      new Date('2026-08-19T00:00:00.000Z'),
      new Date('2026-08-21T23:59:59.000Z'),
    )).toEqual({ start: { date: '2026-08-19' }, end: { date: '2026-08-22' } });
  });
});

describe('convertGoogleEventToInternal', () => {
  const SOURCE_ID = 'cal-source-1';

  describe('timed events', () => {
    it('converts a standard timed event', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-1',
        summary: 'Team Meeting',
        description: 'Weekly standup',
        location: 'Conference Room B',
        start: { dateTime: '2026-03-01T10:00:00-05:00' },
        end: { dateTime: '2026-03-01T11:00:00-05:00' },
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);

      expect(result.externalEventId).toBe('evt-1');
      expect(result.title).toBe('Team Meeting');
      expect(result.description).toBe('Weekly standup');
      expect(result.location).toBe('Conference Room B');
      expect(result.startTime).toEqual(new Date('2026-03-01T10:00:00-05:00'));
      expect(result.endTime).toEqual(new Date('2026-03-01T11:00:00-05:00'));
      expect(result.allDay).toBe(false);
      expect(result.calendarSourceId).toBe(SOURCE_ID);
    });

    it('handles UTC datetime format', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-2',
        summary: 'UTC Event',
        start: { dateTime: '2026-03-01T15:00:00Z' },
        end: { dateTime: '2026-03-01T16:00:00Z' },
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);

      expect(result.startTime).toEqual(new Date('2026-03-01T15:00:00Z'));
      expect(result.endTime).toEqual(new Date('2026-03-01T16:00:00Z'));
      expect(result.allDay).toBe(false);
    });
  });

  describe('all-day events', () => {
    it('detects all-day events (date-only start)', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-3',
        summary: 'Vacation',
        start: { date: '2026-03-01' },
        end: { date: '2026-03-04' },
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);

      expect(result.allDay).toBe(true);
      expect(result.startTime).toEqual(new Date('2026-03-01T00:00:00Z'));
      expect(result.endTime).toEqual(new Date('2026-03-04T00:00:00Z'));
    });
  });

  describe('optional fields', () => {
    it('defaults title to "Untitled Event" when summary is missing', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-4',
        summary: '',
        start: { dateTime: '2026-03-01T10:00:00Z' },
        end: { dateTime: '2026-03-01T11:00:00Z' },
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);
      expect(result.title).toBe('Untitled Event');
    });

    it('returns null for missing description and location', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-5',
        summary: 'Simple Event',
        start: { dateTime: '2026-03-01T10:00:00Z' },
        end: { dateTime: '2026-03-01T11:00:00Z' },
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);
      expect(result.description).toBeNull();
      expect(result.location).toBeNull();
    });
  });

  describe('recurring events', () => {
    it('marks event as recurring when it has recurrence rules', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-6',
        summary: 'Weekly Sync',
        start: { dateTime: '2026-03-01T10:00:00Z' },
        end: { dateTime: '2026-03-01T11:00:00Z' },
        recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO'],
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);

      expect(result.recurring).toBe(true);
      expect(result.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
    });

    it('marks event as recurring when it has recurringEventId', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-7',
        summary: 'Recurring Instance',
        start: { dateTime: '2026-03-08T10:00:00Z' },
        end: { dateTime: '2026-03-08T11:00:00Z' },
        recurringEventId: 'evt-6',
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);

      expect(result.recurring).toBe(true);
      expect(result.recurrenceRule).toBeNull();
    });

    it('marks non-recurring event correctly', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-8',
        summary: 'One-time Event',
        start: { dateTime: '2026-03-01T10:00:00Z' },
        end: { dateTime: '2026-03-01T11:00:00Z' },
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);

      expect(result.recurring).toBe(false);
      expect(result.recurrenceRule).toBeNull();
    });

    it('uses first recurrence rule when multiple exist', () => {
      const event: GoogleCalendarEvent = {
        id: 'evt-9',
        summary: 'Complex Recurring',
        start: { dateTime: '2026-03-01T10:00:00Z' },
        end: { dateTime: '2026-03-01T11:00:00Z' },
        recurrence: [
          'RRULE:FREQ=WEEKLY;BYDAY=MO',
          'EXDATE:20260308T100000Z',
        ],
      };

      const result = convertGoogleEventToInternal(event, SOURCE_ID);
      expect(result.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO');
    });
  });
});
