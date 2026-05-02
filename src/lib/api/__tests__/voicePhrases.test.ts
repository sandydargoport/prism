import {
  phraseEventList,
  phraseUpcomingEvents,
  phraseTaskList,
  phraseFamilyMembers,
} from '../voicePhrases';

const at = (h: number, m = 0) => {
  const d = new Date('2026-01-01T00:00:00');
  d.setHours(h, m);
  return d;
};

describe('phraseEventList', () => {
  it('says no events when list is empty', () => {
    expect(phraseEventList([])).toBe('You have no events today.');
  });

  it('renders a single timed event', () => {
    expect(phraseEventList([
      { title: 'Soccer Practice', startTime: at(16), allDay: false },
    ])).toBe('Today you have Soccer Practice at 4 PM.');
  });

  it('renders an all-day event without a time', () => {
    expect(phraseEventList([
      { title: 'Beach Day', startTime: at(0), allDay: true },
    ])).toBe('Today you have Beach Day, all day.');
  });

  it('renders two events joined with "and"', () => {
    expect(phraseEventList([
      { title: 'Standup', startTime: at(9), allDay: false },
      { title: 'Lunch', startTime: at(12, 30), allDay: false },
    ])).toBe('Today you have Standup at 9 AM and Lunch at 12:30 PM.');
  });

  it('renders three or more events with Oxford comma', () => {
    expect(phraseEventList([
      { title: 'A', startTime: at(8), allDay: false },
      { title: 'B', startTime: at(10), allDay: false },
      { title: 'C', startTime: at(14), allDay: false },
    ])).toBe('Today you have A at 8 AM, B at 10 AM, and C at 2 PM.');
  });

  it('omits zero minutes from the spoken time', () => {
    expect(phraseEventList([
      { title: 'Meeting', startTime: at(9, 0), allDay: false },
    ])).toBe('Today you have Meeting at 9 AM.');
  });

  it('includes non-zero minutes', () => {
    expect(phraseEventList([
      { title: 'Meeting', startTime: at(9, 15), allDay: false },
    ])).toBe('Today you have Meeting at 9:15 AM.');
  });
});

describe('phraseUpcomingEvents', () => {
  const now = new Date('2026-05-02T12:00:00');
  const onDay = (offset: number, h: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(h, 0);
    return d;
  };

  it('says no upcoming when list is empty', () => {
    expect(phraseUpcomingEvents([], now)).toBe('You have no upcoming events.');
  });

  it('uses "today" for events on the same day', () => {
    expect(phraseUpcomingEvents(
      [{ title: 'Soccer', startTime: onDay(0, 16), allDay: false }],
      now,
    )).toBe('Coming up: Soccer today at 4 PM.');
  });

  it('uses "tomorrow" for next-day events', () => {
    expect(phraseUpcomingEvents(
      [{ title: 'Dentist', startTime: onDay(1, 9), allDay: false }],
      now,
    )).toBe('Coming up: Dentist tomorrow at 9 AM.');
  });

  it('uses weekday names within the next week', () => {
    // 2026-05-02 is a Saturday; +3 days = Tuesday
    const out = phraseUpcomingEvents(
      [{ title: 'Movie', startTime: onDay(3, 18), allDay: false }],
      now,
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
    );
    expect(out).toContain(', and ');
    expect(out.startsWith('Coming up: ')).toBe(true);
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
