/**
 * Night on Today (#926).
 */
import { isTodayNight } from '../night';

const at = (h: number, m = 0) => new Date(2026, 10, 5, h, m);
const sunrise = at(6, 30), sunset = at(16, 40);

describe('isTodayNight', () => {
  it('is day from half an hour before sunrise until half an hour after sunset', () => {
    expect(isTodayNight(at(6, 0), sunrise, sunset)).toBe(false);
    expect(isTodayNight(at(12), sunrise, sunset)).toBe(false);
    expect(isTodayNight(at(17, 9), sunrise, sunset)).toBe(false);
  });
  it('is night from dusk, and before dawn', () => {
    expect(isTodayNight(at(17, 10), sunrise, sunset)).toBe(true);
    expect(isTodayNight(at(21, 40), sunrise, sunset)).toBe(true);
    expect(isTodayNight(at(5, 59), sunrise, sunset)).toBe(true);
  });
  it('falls back to 8 pm and 6 am without sun times', () => {
    expect(isTodayNight(at(20))).toBe(true);
    expect(isTodayNight(at(19, 59))).toBe(false);
    expect(isTodayNight(at(5))).toBe(true);
  });
});
