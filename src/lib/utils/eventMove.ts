/**
 * Where an event lands when it is dragged onto another day.
 *
 * Calendar grid days are dates, and an event is placed on them by its date
 * in the display zone (eventOccursOnDisplayDay). A move therefore shifts that
 * date by whole days and keeps everything else:
 *
 * - An all-day event is stored as UTC midnight of its dates, so it moves by
 *   whole UTC days. Measuring it against local midnights, as this used to,
 *   put it a day late west of UTC, where its start is the previous evening.
 * - A timed event keeps its wall-clock start in the display zone and its
 *   duration, which also holds across a DST change and when the display zone
 *   is not the device's.
 */

import {
  addDaysToKey,
  calendarDaysBetween,
  floatingUtcToDateKey,
  todayKey,
  wallTimeAt,
  zonedWallTimeToUtc,
} from './zonedDate';

const MS_PER_DAY = 86_400_000;

export function moveEventToDay(
  event: { startTime: Date; endTime: Date; allDay: boolean },
  targetKey: string,
  displayTimezone: string,
): { startTime: Date; endTime: Date } {
  const duration = event.endTime.getTime() - event.startTime.getTime();

  if (event.allDay) {
    const days = calendarDaysBetween(floatingUtcToDateKey(event.startTime), targetKey);
    return {
      startTime: new Date(event.startTime.getTime() + days * MS_PER_DAY),
      endTime: new Date(event.endTime.getTime() + days * MS_PER_DAY),
    };
  }

  const fromKey = todayKey(displayTimezone, event.startTime);
  const wall = wallTimeAt(displayTimezone, event.startTime);
  // Keep seconds and milliseconds, which the HH:mm wall time drops.
  const subMinute = event.startTime.getTime() % 60_000;
  const startTime = new Date(
    zonedWallTimeToUtc(addDaysToKey(fromKey, calendarDaysBetween(fromKey, targetKey)), wall, displayTimezone)
      .getTime() + subMinute,
  );
  return { startTime, endTime: new Date(startTime.getTime() + duration) };
}
