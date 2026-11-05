/**
 * Night on Today (#926): from dusk, half an hour after sunset, until half an
 * hour before sunrise. Without sun times the evening starts at 8 pm and the
 * morning at 6 am, the same hours the wall already treats as late.
 */
export const DUSK_MINUTES = 30;

export function isTodayNight(now: Date, sunrise?: Date, sunset?: Date): boolean {
  if (sunrise && sunset) {
    const dusk = sunset.getTime() + DUSK_MINUTES * 60_000;
    const dawn = sunrise.getTime() - DUSK_MINUTES * 60_000;
    return now.getTime() >= dusk || now.getTime() < dawn;
  }
  const h = now.getHours();
  return h >= 20 || h < 6;
}
