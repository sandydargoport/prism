import { applyReminderRules, isLate, formatReminderTime } from '../reminders';

describe('applyReminderRules (#1109)', () => {
  it('saves a reminder with no points and no approval, whatever was sent', () => {
    const r = applyReminderRules({ kind: 'reminder', pointValue: 10, requiresApproval: true, nextDueTime: '19:00' });
    expect(r).toEqual({ ok: true, data: { kind: 'reminder', pointValue: 0, requiresApproval: false, nextDueTime: '19:00' } });
  });

  it('refuses a reminder without a time', () => {
    expect(applyReminderRules({ kind: 'reminder', nextDueTime: null })).toEqual({ ok: false, error: 'A reminder needs a time' });
    expect(applyReminderRules({ kind: 'reminder' })).toMatchObject({ ok: false });
  });

  it('on an update, uses the stored kind and time for what the update leaves out', () => {
    const stored = { kind: 'reminder', nextDueTime: '07:00' };
    expect(applyReminderRules({ pointValue: 5 }, stored)).toEqual({ ok: true, data: { pointValue: 0, requiresApproval: false } });
    expect(applyReminderRules({ nextDueTime: null }, stored)).toMatchObject({ ok: false });
  });

  it('leaves a chore as sent', () => {
    const data = { kind: 'chore' as const, pointValue: 10, requiresApproval: true };
    expect(applyReminderRules(data)).toEqual({ ok: true, data });
    expect(applyReminderRules({ pointValue: 3 }, { kind: 'chore', nextDueTime: null })).toEqual({ ok: true, data: { pointValue: 3 } });
  });
});

describe('isLate (#1109)', () => {
  const today = '2026-11-08';
  it('is late once the time has passed today', () => {
    expect(isLate({ nextDue: today, nextDueTime: '19:00' }, today, '19:00')).toBe(true);
    expect(isLate({ nextDue: today, nextDueTime: '19:00' }, today, '21:30')).toBe(true);
  });
  it('is not late before the time', () => {
    expect(isLate({ nextDue: today, nextDueTime: '19:00' }, today, '18:59')).toBe(false);
  });
  it('is late when its day has gone', () => {
    expect(isLate({ nextDue: '2026-11-07', nextDueTime: '19:00' }, today, '06:00')).toBe(true);
  });
  it('is never late without a time, or when due later', () => {
    expect(isLate({ nextDue: '2026-11-07', nextDueTime: null }, today, '23:00')).toBe(false);
    expect(isLate({ nextDue: '2026-11-09', nextDueTime: '07:00' }, today, '23:00')).toBe(false);
  });
});

it('formats a time on a 12-hour clock', () => {
  expect(formatReminderTime('19:00')).toBe('7:00 PM');
  expect(formatReminderTime('00:05')).toBe('12:05 AM');
  expect(formatReminderTime('12:30')).toBe('12:30 PM');
});
