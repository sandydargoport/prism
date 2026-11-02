import { canAddEventsTo, looksReadOnlyCalendar } from '../calendarWritable';

const cal = (provider: string, dashboardCalendarName = 'Family') => ({ provider, dashboardCalendarName });

describe('canAddEventsTo', () => {
  it('offers Prism, Google and CalDAV calendars', () => {
    expect(canAddEventsTo(cal('local'))).toBe(true);
    expect(canAddEventsTo(cal('google'))).toBe(true);
    expect(canAddEventsTo(cal('caldav'))).toBe(true);
  });

  it('does not offer iCal feeds or calendars named like subscriptions', () => {
    expect(canAddEventsTo(cal('ical'))).toBe(false);
    expect(canAddEventsTo(cal('caldav', 'Birthdays'))).toBe(false);
    expect(canAddEventsTo(cal('google', 'Holidays in United States'))).toBe(false);
    expect(canAddEventsTo(cal('local', 'Birthdays'))).toBe(true);
  });
});

describe('looksReadOnlyCalendar', () => {
  it('reads the usual subscription names', () => {
    for (const name of ['Birthdays', 'US Holidays', 'Contacts', 'Subscribed: School', 'Phases of the Moon', 'Week Numbers']) {
      expect(looksReadOnlyCalendar(name)).toBe(true);
    }
    expect(looksReadOnlyCalendar('Work')).toBe(false);
  });
});
