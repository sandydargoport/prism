import {
  phraseEventList,
  phraseUpcomingEvents,
  phraseTaskList,
  phraseFamilyMembers,
  phraseRecentMessages,
  phraseTodayMeals,
  phraseTodayChores,
  phraseWeatherToday,
  phraseBusStatus,
  phraseUpcomingBirthdays,
} from '../voicePhrases';
import { addDaysToKey, zonedWallTimeToUtc } from '@/lib/utils/zonedDate';

// Spoken times and days are the household's, so fixtures are wall times in
// an explicit zone and every call passes it.
const TZ = 'America/Chicago';
const wall = (dateKey: string, h: number, m = 0) =>
  zonedWallTimeToUtc(dateKey, `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, TZ);

const at = (h: number, m = 0) => wall('2026-01-01', h, m);

describe('phraseEventList', () => {
  it('says no events when list is empty', () => {
    expect(phraseEventList([], TZ)).toBe('You have no events today.');
  });

  it('renders a single timed event', () => {
    expect(phraseEventList([
      { title: 'Soccer Practice', startTime: at(16), allDay: false },
    ], TZ)).toBe('Today you have Soccer Practice at 4 PM.');
  });

  it('renders an all-day event without a time', () => {
    expect(phraseEventList([
      { title: 'Beach Day', startTime: at(0), allDay: true },
    ], TZ)).toBe('Today you have Beach Day, all day.');
  });

  it('renders two events joined with "and"', () => {
    expect(phraseEventList([
      { title: 'Standup', startTime: at(9), allDay: false },
      { title: 'Lunch', startTime: at(12, 30), allDay: false },
    ], TZ)).toBe('Today you have Standup at 9 AM and Lunch at 12:30 PM.');
  });

  it('renders three or more events with Oxford comma', () => {
    expect(phraseEventList([
      { title: 'A', startTime: at(8), allDay: false },
      { title: 'B', startTime: at(10), allDay: false },
      { title: 'C', startTime: at(14), allDay: false },
    ], TZ)).toBe('Today you have A at 8 AM, B at 10 AM, and C at 2 PM.');
  });

  it('omits zero minutes from the spoken time', () => {
    expect(phraseEventList([
      { title: 'Meeting', startTime: at(9, 0), allDay: false },
    ], TZ)).toBe('Today you have Meeting at 9 AM.');
  });

  it('includes non-zero minutes', () => {
    expect(phraseEventList([
      { title: 'Meeting', startTime: at(9, 15), allDay: false },
    ], TZ)).toBe('Today you have Meeting at 9:15 AM.');
  });
});

describe('phraseUpcomingEvents', () => {
  const now = wall('2026-05-02', 12);
  const onDay = (offset: number, h: number) => wall(addDaysToKey('2026-05-02', offset), h);

  it('says no upcoming when list is empty', () => {
    expect(phraseUpcomingEvents([], now, TZ)).toBe('You have no upcoming events.');
  });

  it('uses "today" for events on the same day', () => {
    expect(phraseUpcomingEvents(
      [{ title: 'Soccer', startTime: onDay(0, 16), allDay: false }],
      now,
      TZ,
    )).toBe('Coming up: Soccer today at 4 PM.');
  });

  it('uses "tomorrow" for next-day events', () => {
    expect(phraseUpcomingEvents(
      [{ title: 'Dentist', startTime: onDay(1, 9), allDay: false }],
      now,
      TZ,
    )).toBe('Coming up: Dentist tomorrow at 9 AM.');
  });

  it('uses weekday names within the next week', () => {
    // 2026-05-02 is a Saturday; +3 days = Tuesday
    const out = phraseUpcomingEvents(
      [{ title: 'Movie', startTime: onDay(3, 18), allDay: false }],
      now,
      TZ,
    );
    expect(out).toMatch(/Coming up: Movie on (Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w+ at 6 PM\./);
  });

  it('joins multiple events with Oxford comma', () => {
    const out = phraseUpcomingEvents(
      [
        { title: 'A', startTime: onDay(0, 10), allDay: false },
        { title: 'B', startTime: onDay(1, 11), allDay: false },
        { title: 'C', startTime: onDay(2, 12), allDay: false },
      ],
      now,
      TZ,
    );
    expect(out).toContain(', and ');
    expect(out.startsWith('Coming up: ')).toBe(true);
  });
});

describe('voice phrasing in the household zone', () => {
  it('speaks a timed event at its household wall time, not the server clock', () => {
    // 14:00 UTC is 9 AM in Chicago in summer; the old code said "2 PM" on a UTC server.
    expect(phraseEventList(
      [{ title: 'Dentist', startTime: new Date('2026-07-01T14:00:00Z'), allDay: false }],
      TZ,
    )).toBe('Today you have Dentist at 9 AM.');
  });

  it('dates an all-day event by its own date, not the instant', () => {
    // Stored as UTC midnight of 3 May: 7 PM on 2 May in Chicago, but it is 3 May's event.
    const now = wall('2026-05-02', 12);
    expect(phraseUpcomingEvents(
      [{ title: 'Field Day', startTime: new Date('2026-05-03T00:00:00Z'), allDay: true }],
      now,
      TZ,
    )).toBe('Coming up: Field Day tomorrow, all day.');
  });

  it('keeps an evening event on its household day, though it is tomorrow in UTC', () => {
    const now = wall('2026-05-02', 12);
    expect(phraseUpcomingEvents(
      [{ title: 'Movie', startTime: wall('2026-05-02', 20), allDay: false }],
      now,
      TZ,
    )).toBe('Coming up: Movie today at 8 PM.');
  });
});

describe('phraseTaskList', () => {
  it('says no tasks when list is empty', () => {
    expect(phraseTaskList([])).toBe('You have no tasks due today.');
  });

  it('handles a single task', () => {
    expect(phraseTaskList(['Fix faucet'])).toBe('You have one task today: Fix faucet.');
  });

  it('counts and joins multiple tasks', () => {
    expect(phraseTaskList(['A', 'B', 'C']))
      .toBe('You have 3 tasks today: A, B, and C.');
  });
});

describe('phraseFamilyMembers', () => {
  it('handles no members', () => {
    expect(phraseFamilyMembers([])).toBe('No family members are configured.');
  });

  it('handles one member', () => {
    expect(phraseFamilyMembers(['Alex'])).toBe('Your family has Alex.');
  });

  it('joins multiple members with Oxford comma', () => {
    expect(phraseFamilyMembers(['Alex', 'Jordan', 'Emma', 'Sophie']))
      .toBe('Your family has Alex, Jordan, Emma, and Sophie.');
  });
});

describe('phraseWeatherToday', () => {
  it('renders current + high/low', () => {
    const out = phraseWeatherToday({
      location: 'Chicago',
      currentTemp: 65,
      feelsLike: 65,
      description: 'Partly cloudy',
      high: 72,
      low: 58,
      precipProbability: 10,
    });
    expect(out).toMatch(/Chicago: currently 65 degrees\./);
    expect(out).toContain('Partly cloudy');
    expect(out).toContain('high 72, low 58');
    expect(out).not.toContain('feels like');
  });

  it('includes feels-like when it differs by 3+ degrees', () => {
    const out = phraseWeatherToday({
      location: 'Chicago',
      currentTemp: 32,
      feelsLike: 22,
      description: 'Windy',
      high: 35,
      low: 28,
      precipProbability: null,
    });
    expect(out).toContain('feels like 22');
  });

  it('mentions precipitation only when probability is 30+%', () => {
    const wet = phraseWeatherToday({
      location: 'X', currentTemp: 60, feelsLike: 60, description: 'Rain', high: 65, low: 55, precipProbability: 70,
    });
    expect(wet).toContain('70 percent chance of precipitation');

    const dry = phraseWeatherToday({
      location: 'X', currentTemp: 60, feelsLike: 60, description: 'Sun', high: 65, low: 55, precipProbability: 10,
    });
    expect(dry).not.toContain('precipitation');
  });
});

describe('phraseBusStatus', () => {
  const mk = (overrides = {}) => ({
    studentName: 'Emma',
    direction: 'AM' as const,
    scheduledTime: '07:30',
    prediction: { status: 'no_data', etaMinutes: null, lastCheckpointName: null },
    ...overrides,
  });

  it('says no routes when empty', () => {
    expect(phraseBusStatus([])).toBe('No bus routes are scheduled today.');
  });

  it('mentions student name when scoped + empty', () => {
    expect(phraseBusStatus([], { student: 'Emma' }))
      .toBe('No bus routes are scheduled for Emma today.');
  });

  it('renders ETA for in-transit', () => {
    const out = phraseBusStatus([
      mk({ prediction: { status: 'in_transit', etaMinutes: 5, lastCheckpointName: 'Maple' } }),
    ]);
    expect(out).toContain('Emma AM: 5 minutes away');
  });

  it('renders at_stop / at_school', () => {
    expect(phraseBusStatus([mk({ prediction: { status: 'at_stop', etaMinutes: null, lastCheckpointName: null } })]))
      .toContain('arrived at the stop');
    expect(phraseBusStatus([mk({ prediction: { status: 'at_school', etaMinutes: null, lastCheckpointName: null } })]))
      .toContain('arrived at school');
  });

  it('falls back when no live data yet', () => {
    expect(phraseBusStatus([mk({ prediction: { status: 'cold_start', etaMinutes: null, lastCheckpointName: null } })]))
      .toContain('no live data yet');
  });
});

describe('phraseUpcomingBirthdays', () => {
  it('handles empty', () => {
    expect(phraseUpcomingBirthdays([])).toBe('No upcoming birthdays.');
  });

  it('renders a single birthday with turning age', () => {
    const out = phraseUpcomingBirthdays([
      { name: 'Emma', eventType: 'birthday', next: '2026-05-04', daysUntil: 2, turning: 8 },
    ]);
    expect(out).toBe("Coming up: Emma's birthday on Monday, turning 8.");
  });

  it('says today and tomorrow from daysUntil', () => {
    const out = phraseUpcomingBirthdays([
      { name: 'Emma', eventType: 'birthday', next: '2026-05-02', daysUntil: 0, turning: null },
      { name: 'Sophie', eventType: 'anniversary', next: '2026-05-03', daysUntil: 1, turning: null },
    ]);
    expect(out).toBe("Coming up: Emma's birthday today and Sophie's anniversary tomorrow.");
  });

  it('names the stored date, whatever the process zone', () => {
    const out = phraseUpcomingBirthdays([
      { name: 'Alex', eventType: 'birthday', next: '2026-05-22', daysUntil: 20, turning: null },
    ]);
    expect(out).toBe("Coming up: Alex's birthday on May 22.");
  });

  it('joins multiple with Oxford comma', () => {
    const out = phraseUpcomingBirthdays([
      { name: 'Emma', eventType: 'birthday', next: '2026-05-04', daysUntil: 2, turning: null },
      { name: 'Sophie', eventType: 'birthday', next: '2026-05-12', daysUntil: 10, turning: null },
      { name: 'Alex', eventType: 'birthday', next: '2026-05-22', daysUntil: 20, turning: null },
    ]);
    expect(out).toContain(', and ');
  });
});

describe('phraseTodayMeals', () => {
  it('handles no meals', () => {
    expect(phraseTodayMeals([])).toBe('No meals are planned for today.');
  });

  it('renders a single meal', () => {
    expect(phraseTodayMeals([{ name: 'Tacos', mealType: 'dinner' }]))
      .toBe("Today's plan is dinner: Tacos.");
  });

  it('joins multiple meals', () => {
    expect(phraseTodayMeals([
      { name: 'Oatmeal', mealType: 'breakfast' },
      { name: 'Salad', mealType: 'lunch' },
      { name: 'Tacos', mealType: 'dinner' },
    ])).toBe("Today's meals: breakfast: Oatmeal, lunch: Salad, and dinner: Tacos.");
  });
});

describe('phraseTodayChores', () => {
  it('says no chores when empty (anonymous)', () => {
    expect(phraseTodayChores([])).toBe('No chores are due today.');
  });

  it('says no chores when empty (named assignee)', () => {
    expect(phraseTodayChores([], 'Emma')).toBe('Emma has no chores due today.');
  });

  it('handles a single chore (anonymous)', () => {
    expect(phraseTodayChores(['Take out trash']))
      .toBe('You have one chore today: Take out trash.');
  });

  it('handles a single chore (named)', () => {
    expect(phraseTodayChores(['Feed the dog'], 'Emma'))
      .toBe('Emma has one chore today: Feed the dog.');
  });

  it('counts and joins multiple chores', () => {
    expect(phraseTodayChores(['A', 'B', 'C'], 'Emma'))
      .toBe('Emma has 3 chores today: A, B, and C.');
  });
});

describe('phraseRecentMessages', () => {
  const now = wall('2026-05-02', 12);
  const at = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d;
  };

  it('handles empty list', () => {
    expect(phraseRecentMessages([], now, TZ)).toBe('No recent family messages.');
  });

  it('renders a single message', () => {
    const out = phraseRecentMessages(
      [{ message: 'soccer at 4', authorName: 'Alex', createdAt: at(0) }],
      now,
      TZ,
    );
    expect(out).toBe('Latest message from Alex today: soccer at 4.');
  });

  it('falls back when authorName is null', () => {
    const out = phraseRecentMessages(
      [{ message: 'hello', authorName: null, createdAt: at(0) }],
      now,
      TZ,
    );
    expect(out).toBe('Latest message from today: hello.');
  });

  it('joins multiple messages with Oxford comma', () => {
    const out = phraseRecentMessages(
      [
        { message: 'first', authorName: 'Alex', createdAt: at(0) },
        { message: 'second', authorName: 'Jordan', createdAt: at(1) },
      ],
      now,
      TZ,
    );
    expect(out).toBe('Recent messages: Alex today: first and Jordan yesterday: second.');
  });
});
