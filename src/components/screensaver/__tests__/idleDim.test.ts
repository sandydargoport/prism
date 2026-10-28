/**
 * Dim when idle (#691): how dark the idle screen is, and when. The hours are
 * the calendar's hidden hours, so one setting moves both.
 */
import type { CalendarEvent } from '@/types/calendar';
import type { HiddenHoursSettings } from '@/lib/hooks/useHiddenHours';
import { describeDimHours, dimAt, dimLevel } from '../idleDim';

// Local time on the test's own clock, as the screen reads its own.
const at = (h: number, m = 0) => new Date(2026, 9, 28, h, m);

const manual = (startHour: number, endHour: number): HiddenHoursSettings =>
  ({ mode: 'manual', startHour, endHour, bufferHours: 1, enabled: false });
const autoFit: HiddenHoursSettings = { mode: 'auto-fit', startHour: 0, endHour: 6, bufferHours: 1, enabled: false };

const event = (from: Date, to: Date, allDay = false) =>
  ({ id: String(from.getTime()), title: 'x', startTime: from, endTime: to, allDay }) as CalendarEvent;

describe('dimLevel', () => {
  it('is off when nothing, or nothing it knows, is stored', () => {
    expect(dimLevel(null)).toBe(0);
    expect(dimLevel('1')).toBe(0);
    expect(dimLevel('0.7')).toBe(0);
    expect(dimLevel('0.5')).toBe(0.5);
  });
});

describe('dimAt, with a fixed hidden range', () => {
  it('dims inside the range across midnight, up to but not including the end hour', () => {
    const hours = manual(22, 7);
    expect(dimAt('0.5', hours, [], at(21, 59))).toBe(0);
    expect(dimAt('0.5', hours, [], at(22, 0))).toBe(0.5);
    expect(dimAt('0.5', hours, [], at(3, 0))).toBe(0.5);
    expect(dimAt('0.5', hours, [], at(6, 59))).toBe(0.5);
    expect(dimAt('0.5', hours, [], at(7, 0))).toBe(0);
  });

  it('follows the range even while the calendar is showing every hour', () => {
    // `enabled` is the calendar's clock button, which is about the view.
    expect(dimAt('0.75', { ...manual(0, 6), enabled: false }, [], at(2, 0))).toBe(0.75);
  });

  it('does nothing when off', () => {
    expect(dimAt('0', manual(0, 6), [], at(2, 0))).toBe(0);
  });
});

describe('dimAt, with auto-fit', () => {
  it('stays bright from an hour before the first event to an hour after the last', () => {
    const events = [event(at(9), at(10)), event(at(18, 30), at(20))];
    expect(dimAt('0.5', autoFit, events, at(7, 59))).toBe(0.5);
    expect(dimAt('0.5', autoFit, events, at(8, 0))).toBe(0);
    expect(dimAt('0.5', autoFit, events, at(20, 59))).toBe(0);
    expect(dimAt('0.5', autoFit, events, at(21, 0))).toBe(0.5);
  });

  it('ignores all-day events and other days, and keeps 8 am to 7 pm bright on a day without any', () => {
    const events = [event(at(0), at(23, 59), true), event(new Date(2026, 9, 29, 6), new Date(2026, 9, 29, 7))];
    expect(dimAt('0.5', autoFit, events, at(7, 0))).toBe(0.5);
    expect(dimAt('0.5', autoFit, events, at(12, 0))).toBe(0);
    expect(dimAt('0.5', autoFit, events, at(18, 59))).toBe(0);
    expect(dimAt('0.5', autoFit, events, at(19, 0))).toBe(0.5);
  });
});

describe('describeDimHours', () => {
  it('says when, in the words Settings shows', () => {
    expect(describeDimHours(manual(0, 6))).toBe('from 12 am to 6 am');
    expect(describeDimHours(manual(22, 7))).toBe('from 10 pm to 7 am');
    expect(describeDimHours(autoFit)).toMatch(/first timed event .* 1 hour either side/);
  });
});
