import {
  buildRepeatRule,
  defaultRepeatSpec,
  firstRepeatDate,
  parseRepeatRule,
  weekdayOfMonth,
  type RepeatSpec,
} from '../repeatRule';

const CHICAGO = 'America/Chicago';
// Wednesday 18 November 2026: the third Wednesday of its month.
const START = '2026-11-18';
const spec = (over: Partial<RepeatSpec>): RepeatSpec => ({ ...defaultRepeatSpec(START), ...over });

describe('buildRepeatRule', () => {
  it('builds the schedules families ask for', () => {
    // Every other Tuesday.
    expect(buildRepeatRule(spec({ interval: 2, weekdays: [2] }), START, false, CHICAGO))
      .toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=TU');
    // Tue and Thu, Monday-first order whatever order they were picked in.
    expect(buildRepeatRule(spec({ weekdays: [4, 2] }), START, false, CHICAGO))
      .toBe('FREQ=WEEKLY;BYDAY=TU,TH');
    // Every 3 weeks on the start's weekday.
    expect(buildRepeatRule(spec({ interval: 3 }), START, false, CHICAGO))
      .toBe('FREQ=WEEKLY;INTERVAL=3;BYDAY=WE');
    // Monthly on the third Wednesday, and on the 18th.
    expect(buildRepeatRule(spec({ freq: 'MONTHLY', by: 'weekday' }), START, false, CHICAGO))
      .toBe('FREQ=MONTHLY;BYDAY=3WE');
    expect(buildRepeatRule(spec({ freq: 'MONTHLY' }), START, false, CHICAGO))
      .toBe('FREQ=MONTHLY;BYMONTHDAY=18');
    // Yearly on the third Wednesday of November, and on 18 November.
    expect(buildRepeatRule(spec({ freq: 'YEARLY', by: 'weekday' }), START, false, CHICAGO))
      .toBe('FREQ=YEARLY;BYMONTH=11;BYDAY=3WE');
    expect(buildRepeatRule(spec({ freq: 'YEARLY' }), START, false, CHICAGO))
      .toBe('FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=18');
  });

  it('calls a fifth weekday the last one', () => {
    // 30 Nov 2026 is the fifth Monday.
    expect(buildRepeatRule(spec({ freq: 'MONTHLY', by: 'weekday' }), '2026-11-30', false, CHICAGO))
      .toBe('FREQ=MONTHLY;BYDAY=-1MO');
  });

  it('ends after a count', () => {
    expect(buildRepeatRule(spec({ freq: 'DAILY', ends: { type: 'count', count: 10 } }), START, false, CHICAGO))
      .toBe('FREQ=DAILY;COUNT=10');
  });

  it('ends on a date: the end of that day in the household zone for a timed event', () => {
    // 15 June 2027 23:59:59 in Chicago (CDT) is 04:59:59Z on the 16th.
    expect(buildRepeatRule(spec({ weekdays: [2, 4], ends: { type: 'until', date: '2027-06-15' } }), START, false, CHICAGO))
      .toBe('FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20270616T045959Z');
  });

  it('ends on a date: the date itself for an all-day event', () => {
    expect(buildRepeatRule(spec({ ends: { type: 'until', date: '2027-06-15' } }), START, true, CHICAGO))
      .toBe('FREQ=WEEKLY;BYDAY=WE;UNTIL=20270615');
  });
});

describe('parseRepeatRule', () => {
  it('reads back every rule the builder writes', () => {
    const specs: RepeatSpec[] = [
      spec({ interval: 2, weekdays: [2] }),
      spec({ weekdays: [2, 4], ends: { type: 'until', date: '2027-06-15' } }),
      spec({ freq: 'MONTHLY', by: 'weekday' }),
      spec({ freq: 'MONTHLY', ends: { type: 'count', count: 6 } }),
      spec({ freq: 'YEARLY', by: 'weekday' }),
      spec({ freq: 'YEARLY' }),
      spec({ freq: 'DAILY', interval: 3 }),
    ];
    for (const s of specs) {
      for (const allDay of [false, true]) {
        expect(parseRepeatRule(buildRepeatRule(s, START, allDay, CHICAGO), START, CHICAGO)).toEqual(s);
      }
    }
  });

  it('reads the preset rules, which leave the day to the start date', () => {
    expect(parseRepeatRule('FREQ=WEEKLY', START, CHICAGO)).toEqual(spec({ weekdays: [3] }));
    expect(parseRepeatRule('FREQ=MONTHLY', START, CHICAGO)).toEqual(spec({ freq: 'MONTHLY' }));
    expect(parseRepeatRule('RRULE:FREQ=YEARLY', START, CHICAGO)).toEqual(spec({ freq: 'YEARLY' }));
  });

  it('reads a UTC UNTIL as the household date it falls on', () => {
    // Midnight UTC on 16 Dec is the evening of 15 Dec in Chicago.
    expect(parseRepeatRule('FREQ=WEEKLY;BYDAY=MO;UNTIL=20261216T000000Z', '2026-11-02', CHICAGO)?.ends)
      .toEqual({ type: 'until', date: '2026-12-15' });
  });

  it('accepts "last" for a start that is the last of its weekday in the month', () => {
    // 25 Nov 2026 is the fourth and last Wednesday.
    expect(parseRepeatRule('FREQ=MONTHLY;BYDAY=-1WE', '2026-11-25', CHICAGO)?.by).toBe('weekday');
    expect(parseRepeatRule('FREQ=MONTHLY;BYDAY=-1WE', START, CHICAGO)).toBeNull();
  });

  it('refuses what the builder cannot show exactly, so the form keeps it as it is', () => {
    for (const rule of [
      'FREQ=HOURLY',
      'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1',
      'FREQ=MONTHLY;BYMONTHDAY=1,15',
      'FREQ=MONTHLY;BYMONTHDAY=5',
      'FREQ=MONTHLY;BYDAY=2TU',
      'FREQ=YEARLY;BYMONTH=6',
      'FREQ=DAILY;COUNT=3;UNTIL=20270101',
      'FREQ=WEEKLY;BYDAY=XX',
      'not a rule',
    ]) {
      expect(parseRepeatRule(rule, START, CHICAGO)).toBeNull();
    }
  });
});

describe('weekdayOfMonth', () => {
  it('names the nth weekday and whether it is the last', () => {
    expect(weekdayOfMonth('2026-11-18')).toEqual({ weekday: 3, nth: 3, isLast: false });
    expect(weekdayOfMonth('2026-11-25')).toEqual({ weekday: 3, nth: 4, isLast: true });
    expect(weekdayOfMonth('2026-11-30')).toEqual({ weekday: 1, nth: -1, isLast: true });
  });
});

describe('firstRepeatDate', () => {
  it('moves a start that is not on one of the chosen days to the next one', () => {
    // Monday 16 Nov, repeating Tue/Thu: begins Tuesday 17 Nov.
    expect(firstRepeatDate('2026-11-16', spec({ weekdays: [2, 4] }))).toBe('2026-11-17');
    // Friday 20 Nov: next is Tuesday 24 Nov.
    expect(firstRepeatDate('2026-11-20', spec({ weekdays: [2, 4] }))).toBe('2026-11-24');
    expect(firstRepeatDate('2026-11-17', spec({ weekdays: [2, 4] }))).toBe('2026-11-17');
    expect(firstRepeatDate('2026-11-16', spec({ freq: 'MONTHLY' }))).toBe('2026-11-16');
  });
});
