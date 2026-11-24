/**
 * Where a long dashboard list opens (#1369, #1370): at the next item, with
 * the items that are over above it, and when a meal counts as over.
 */
import { startAnchor, START_AT_END, type StartEntry } from '../startAtNext';
import { isMealOver } from '@/components/calendar/cells/itemTime';
import type { Meal } from '@/types';

const e = (key: string, group: string, over: boolean, candidate?: boolean): StartEntry => ({ key, group, over, candidate });

describe('startAnchor', () => {
  it('opens at the day heading when nothing that day is over yet', () => {
    expect(startAnchor([e('m1', 'mon', true), e('m2', 'mon', true), e('t1', 'tue', false), e('t2', 'tue', false)])).toBe('tue');
  });

  it('opens at the item itself when items that are over sit above it in its day', () => {
    expect(startAnchor([e('m1', 'mon', true), e('t1', 'tue', true), e('t2', 'tue', false)])).toBe('t2');
  });

  it('opens at the top when the first item is next', () => {
    expect(startAnchor([e('t1', 'tue', false), e('t2', 'tue', true)])).toBe('tue');
  });

  it('skips items that may not be the start (all-day backdrop)', () => {
    expect(startAnchor([e('a', 'tue', false, false), e('t1', 'tue', true), e('t2', 'tue', false)])).toBe('t2');
    expect(startAnchor([e('a', 'tue', false, false), e('t1', 'tue', false)])).toBe('tue');
  });

  it('opens at the end when everything is over, and nowhere when empty', () => {
    expect(startAnchor([e('m1', 'mon', true)])).toBe(START_AT_END);
    expect(startAnchor([])).toBeNull();
  });
});

describe('isMealOver', () => {
  const meal = (mealType: Meal['mealType'], mealTime?: string): Meal => ({
    id: mealType, name: mealType, weekOf: '2027-03-07', date: '2027-03-11', dayOfWeek: 'thursday',
    mealType, mealTime, createdAt: new Date(0),
  });
  const at = (h: number, m = 0) => new Date(2027, 2, 11, h, m);

  it('ends an hour after the usual time for its type', () => {
    expect(isMealOver('2027-03-11', meal('breakfast'), at(7, 59))).toBe(false);
    expect(isMealOver('2027-03-11', meal('breakfast'), at(8, 0))).toBe(true);
    expect(isMealOver('2027-03-11', meal('dinner'), at(18, 30))).toBe(false);
    expect(isMealOver('2027-03-11', meal('dinner'), at(19, 0))).toBe(true);
  });

  it('uses the time set on the meal when there is one', () => {
    expect(isMealOver('2027-03-11', meal('lunch', '13:30'), at(14, 0))).toBe(false);
    expect(isMealOver('2027-03-11', meal('lunch', '13:30'), at(14, 30))).toBe(true);
  });

  it('an earlier day is over, a later day is not', () => {
    expect(isMealOver('2027-03-10', meal('dinner'), at(6))).toBe(true);
    expect(isMealOver('2027-03-12', meal('breakfast'), at(23))).toBe(false);
  });
});
