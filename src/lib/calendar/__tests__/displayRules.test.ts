import { birthdayName, birthdayTitle, hiddenByTime, parseDisplayRules } from '../displayRules';

describe('per-calendar display rules (#877)', () => {
  it('keeps only the rules it knows, in their shapes', () => {
    expect(parseDisplayRules({ busyOnly: true, hideAfter: '11:00', birthdays: true })).toEqual({ busyOnly: true, hideAfter: '11:00', birthdays: true });
    expect(parseDisplayRules({ hideAfter: '25:00', busyOnly: 'yes', other: 1 })).toBeNull();
    expect(parseDisplayRules(null)).toBeNull();
  });

  describe('birthdays as name and age', () => {
    const list = [{ name: 'Emma', birthDate: '2017-03-14' }, { name: 'Grandpa', birthDate: '1904-06-01' }];

    it('finds the name in the usual titles', () => {
      expect(birthdayName("Emma's birthday")).toBe('Emma');
      expect(birthdayName('Emma’s Birthday')).toBe('Emma');
      expect(birthdayName('Birthday: Emma')).toBe('Emma');
      expect(birthdayName('Emma Birthday')).toBe('Emma');
      expect(birthdayName('Dentist')).toBeNull();
    });

    it('reads as name and the age turned that year', () => {
      expect(birthdayTitle("Emma's birthday", '2026-03-14', list)).toBe('Emma, 9');
      expect(birthdayTitle('birthday - emma', '2027-03-14', list)).toBe('Emma, 10');
    });

    it('keeps the title without a match or a real birth year', () => {
      expect(birthdayTitle("Sam's birthday", '2026-03-14', list)).toBe("Sam's birthday");
      expect(birthdayTitle("Grandpa's birthday", '2026-06-01', list)).toBe("Grandpa's birthday");
      expect(birthdayTitle('Dentist', '2026-03-14', list)).toBe('Dentist');
    });
  });

  describe('hide after a time of day', () => {
    const today = '2026-11-05';
    it("hides today's event once the time has passed", () => {
      expect(hiddenByTime({ hideAfter: '11:00', eventDayKeys: [today], todayKey: today, nowMinutes: 11 * 60 + 1 })).toBe(true);
      expect(hiddenByTime({ hideAfter: '11:00', eventDayKeys: [today], todayKey: today, nowMinutes: 10 * 60 + 59 })).toBe(false);
    });

    it('leaves other days alone, and anything without the rule', () => {
      expect(hiddenByTime({ hideAfter: '11:00', eventDayKeys: ['2026-11-06'], todayKey: today, nowMinutes: 12 * 60 })).toBe(false);
      expect(hiddenByTime({ hideAfter: undefined, eventDayKeys: [today], todayKey: today, nowMinutes: 23 * 60 })).toBe(false);
    });
  });
});
