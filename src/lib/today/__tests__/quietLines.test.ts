/**
 * The quiet lines on Today (#911).
 */
import { birthdayNudge, choresLeft, NUDGE, type BirthdayLike } from '../quietLines';

const chore = (id: string, nextDue: string | null, extra: object = {}) => ({ id, title: id, enabled: true, nextDue, ...extra });

describe('choresLeft', () => {
  it('counts what is due today or overdue, and not what is done, waiting or switched off', () => {
    const left = choresLeft([
      chore('due today', '2026-11-05'),
      chore('overdue', '2026-11-01'),
      chore('done (moved on to tomorrow)', '2026-11-06'),
      chore('waiting for a parent', '2026-11-05', { pendingApproval: { completionId: 'x' } }),
      chore('off', '2026-11-05', { enabled: false }),
      chore('no date', null),
    ], '2026-11-05');
    expect(left.map((c) => c.id)).toEqual(['due today', 'overdue']);
  });
});

const bday = (id: string, daysUntil: number, extra: Partial<BirthdayLike> = {}): BirthdayLike =>
  ({ id, name: id, eventType: 'birthday', age: 73, daysUntil, nextBirthday: '2026-11-12', ...extra });
const never = () => false;

describe('birthdayNudge', () => {
  it('offers the nearest birthday within a week, with the card due three days before', () => {
    const n = birthdayNudge([bday('later', 6), bday('soon', 5)], { hour: 9, putOff: never });
    expect(n).toMatchObject({ name: 'soon', daysUntil: 5, mailInDays: 5 - NUDGE.cardDaysBefore });
  });
  it('asks for tomorrow when three days before has already passed', () => {
    expect(birthdayNudge([bday('close', 3)], { hour: 9, putOff: never })!.mailInDays).toBe(1);
    expect(birthdayNudge([bday('closer', 2)], { hour: 9, putOff: never })!.mailInDays).toBe(1);
  });
  it('says nothing when it is too late to mail a card, or too far off', () => {
    expect(birthdayNudge([bday('tomorrow', 1), bday('far', 8)], { hour: 9, putOff: never })).toBeNull();
  });
  it('stays hidden once put off, and offers the next one instead', () => {
    const n = birthdayNudge([bday('put off', 4), bday('next', 6)], { hour: 9, putOff: (b) => b.id === 'put off' });
    expect(n!.name).toBe('next');
  });
  it('is quiet from 8 pm and back in the morning', () => {
    expect(birthdayNudge([bday('a', 4)], { hour: 20, putOff: never })).toBeNull();
    expect(birthdayNudge([bday('a', 4)], { hour: 7, putOff: never })).not.toBeNull();
  });
  it('leaves anniversaries and milestones alone', () => {
    expect(birthdayNudge([bday('wedding', 4, { eventType: 'anniversary' })], { hour: 9, putOff: never })).toBeNull();
  });
});
