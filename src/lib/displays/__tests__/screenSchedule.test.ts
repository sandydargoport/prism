/**
 * Time-of-day rules (#692): which dashboard a screen shows at a given moment,
 * read on the household's wall clock.
 */
import {
  MAX_SCHEDULE_RULES,
  parseSchedule,
  ruleCovers,
  scheduledDashboard,
  serializeSchedule,
  type ScheduleRule,
} from '../screenSchedule';

const MORNING = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NIGHT = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WEEKDAYS = [1, 2, 3, 4, 5];
const CHICAGO = 'America/Chicago';

const morning: ScheduleRule = { days: WEEKDAYS, from: '07:00', to: '07:45', dashboardId: MORNING };
const night: ScheduleRule = { days: [5, 6], from: '22:00', to: '06:00', dashboardId: NIGHT };

// 2026-11-02 is a Monday. Chicago is UTC-6 from 2026-11-01 (DST ends).
const chicago = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00-06:00`);

describe('ruleCovers', () => {
  it('includes the first minute and excludes the last', () => {
    expect(ruleCovers(morning, 1, 6 * 60 + 59)).toBe(false);
    expect(ruleCovers(morning, 1, 7 * 60)).toBe(true);
    expect(ruleCovers(morning, 1, 7 * 60 + 44)).toBe(true);
    expect(ruleCovers(morning, 1, 7 * 60 + 45)).toBe(false);
  });

  it('only on the days ticked', () => {
    expect(ruleCovers(morning, 0, 7 * 60 + 10)).toBe(false);
    expect(ruleCovers(morning, 6, 7 * 60 + 10)).toBe(false);
    expect(ruleCovers(morning, 5, 7 * 60 + 10)).toBe(true);
  });

  it('a window past midnight runs into the next morning of the day it starts on', () => {
    // Friday 23:00 and Saturday 05:59 belong to Friday's window.
    expect(ruleCovers(night, 5, 23 * 60)).toBe(true);
    expect(ruleCovers(night, 6, 5 * 60 + 59)).toBe(true);
    expect(ruleCovers(night, 6, 6 * 60)).toBe(false);
    // Sunday morning belongs to Saturday night's window; Monday morning to nothing.
    expect(ruleCovers(night, 0, 3 * 60)).toBe(true);
    expect(ruleCovers(night, 1, 3 * 60)).toBe(false);
    // Thursday night is not ticked.
    expect(ruleCovers(night, 4, 23 * 60)).toBe(false);
    expect(ruleCovers(night, 5, 3 * 60)).toBe(false);
  });

  it('equal start and end is the whole day', () => {
    const allDay: ScheduleRule = { days: [0, 6], from: '00:00', to: '00:00', dashboardId: NIGHT };
    expect(ruleCovers(allDay, 6, 0)).toBe(true);
    expect(ruleCovers(allDay, 6, 23 * 60 + 59)).toBe(true);
    expect(ruleCovers(allDay, 1, 12 * 60)).toBe(false);
  });
});

describe('scheduledDashboard', () => {
  it('reads the household wall clock, not UTC', () => {
    // 07:10 Monday in Chicago is 13:10 UTC.
    expect(scheduledDashboard([morning], chicago('2026-11-02', '07:10'), CHICAGO)).toEqual({ rule: 0, dashboardId: MORNING });
    expect(scheduledDashboard([morning], chicago('2026-11-02', '07:10'), 'UTC')).toEqual({ rule: -1, dashboardId: null });
    // The weekday too: Sunday 23:30 in Chicago is already Monday in UTC.
    expect(scheduledDashboard([night], chicago('2026-11-01', '23:30'), CHICAGO).dashboardId).toBeNull();
    expect(scheduledDashboard([night], chicago('2026-11-07', '23:30'), CHICAGO).dashboardId).toBe(NIGHT);
  });

  it('the boundary minute belongs to the rule that starts there', () => {
    expect(scheduledDashboard([morning], chicago('2026-11-02', '06:59'), CHICAGO).rule).toBe(-1);
    expect(scheduledDashboard([morning], chicago('2026-11-02', '07:00'), CHICAGO).rule).toBe(0);
    expect(scheduledDashboard([morning], chicago('2026-11-02', '07:45'), CHICAGO).rule).toBe(-1);
  });

  it('overlapping rules: the first in the list wins', () => {
    const early: ScheduleRule = { days: WEEKDAYS, from: '06:30', to: '08:00', dashboardId: NIGHT };
    const at = chicago('2026-11-02', '07:10');
    expect(scheduledDashboard([morning, early], at, CHICAGO)).toEqual({ rule: 0, dashboardId: MORNING });
    expect(scheduledDashboard([early, morning], at, CHICAGO)).toEqual({ rule: 0, dashboardId: NIGHT });
  });

  it('skips a rule whose dashboard is gone', () => {
    const early: ScheduleRule = { days: WEEKDAYS, from: '06:30', to: '08:00', dashboardId: NIGHT };
    const at = chicago('2026-11-02', '07:10');
    expect(scheduledDashboard([morning, early], at, CHICAGO, (id) => id !== MORNING)).toEqual({ rule: 1, dashboardId: NIGHT });
    expect(scheduledDashboard([morning], at, CHICAGO, () => false)).toEqual({ rule: -1, dashboardId: null });
  });
});

describe('stored value', () => {
  it('round-trips and drops what it cannot read', () => {
    const raw = serializeSchedule([morning, night]);
    expect(parseSchedule(raw)).toEqual([morning, night]);
    expect(parseSchedule(JSON.stringify([
      morning,
      { ...morning, from: '7:00' },
      { ...morning, to: '24:00' },
      { ...morning, days: [] },
      { ...morning, days: [9] },
      { ...morning, dashboardId: '' },
      'nonsense',
    ]))).toEqual([morning]);
    expect(parseSchedule('not json')).toEqual([]);
    expect(parseSchedule('{"days":[1]}')).toEqual([]);
    expect(parseSchedule(null)).toEqual([]);
  });

  it('no rules unsets the setting, and the list is capped', () => {
    expect(serializeSchedule([])).toBeNull();
    const many = Array.from({ length: MAX_SCHEDULE_RULES + 3 }, () => morning);
    expect(parseSchedule(serializeSchedule(many))).toHaveLength(MAX_SCHEDULE_RULES);
  });

  it('a full list fits within the setting length limit', async () => {
    const { SCREEN_SETTING_MAX_LENGTH } = await import('../screenSettings');
    const full = Array.from({ length: MAX_SCHEDULE_RULES }, () => ({ ...morning, days: [0, 1, 2, 3, 4, 5, 6] }));
    expect(serializeSchedule(full)!.length).toBeLessThanOrEqual(SCREEN_SETTING_MAX_LENGTH);
  });
});
