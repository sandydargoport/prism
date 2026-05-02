import { phraseEventList } from '../voicePhrases';

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
