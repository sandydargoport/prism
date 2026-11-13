/**
 * A Prism meal as a Tandoor or Mealie entry (#1206), and the comparison that
 * decides whether a synced meal changed.
 */
jest.mock('@/lib/db/client', () => ({ db: {} }));

import { toTandoorEntry, pickTandoorMealType } from '../tandoorMealPlan';
import { toMealieEntry } from '../mealieMealPlan';
import { mealFingerprint, type MealToPush } from '../mealWriter';

const TYPES = [
  { id: 1, name: 'Dinner', time: '18:00:00' },
  { id: 2, name: 'Lunch', time: '12:30:00' },
  { id: 3, name: 'Dessert', time: null },
];

const MEAL: MealToPush = {
  name: 'Tacos',
  description: null,
  servings: null,
  date: '2026-11-20',
  mealType: 'dinner',
  mealTime: null,
  recipeExternalId: null,
};

describe('pickTandoorMealType', () => {
  it('uses the server type of the same kind, by id', () => {
    expect(pickTandoorMealType(TYPES, 'lunch')).toEqual({ ref: { id: 2 }, time: '12:30' });
    expect(pickTandoorMealType(TYPES, 'snack').ref).toEqual({ id: 3 }); // dessert reads as snack
  });

  it('names a type the server does not have, so Tandoor adds it', () => {
    expect(pickTandoorMealType(TYPES, 'breakfast')).toEqual({ ref: { name: 'Breakfast' }, time: null });
  });
});

describe('toTandoorEntry', () => {
  it('uses the meal type\'s time when the meal has none, in the household zone, and fills servings', () => {
    const e = toTandoorEntry(MEAL, TYPES, 'America/Chicago');
    expect(e).toEqual({
      title: 'Tacos', recipeId: null, servings: 1, note: '',
      fromDate: '2026-11-21T00:00:00.000Z', // 18:00 in Chicago (CST, UTC-6)
      mealType: { id: 1 },
    });
  });

  it('keeps the meal\'s own time and links the recipe that came from this server', () => {
    const e = toTandoorEntry({ ...MEAL, mealTime: '18:30', servings: 4, recipeExternalId: '7' }, TYPES, 'America/Chicago');
    expect(e.fromDate).toBe('2026-11-21T00:30:00.000Z');
    expect(e.recipeId).toBe(7);
    expect(e.servings).toBe(4);
  });

  it('falls back to Prism\'s default time when neither has one', () => {
    expect(toTandoorEntry({ ...MEAL, mealType: 'breakfast' }, TYPES, 'UTC').fromDate).toBe('2026-11-20T07:00:00.000Z');
  });
});

describe('toMealieEntry', () => {
  it('sends the date, type, name, note and the Mealie recipe id', () => {
    expect(toMealieEntry({ ...MEAL, description: 'extra salsa', recipeExternalId: 'uuid-1' })).toEqual({
      date: '2026-11-20', entryType: 'dinner', title: 'Tacos', text: 'extra salsa', recipeId: 'uuid-1',
    });
  });
});

describe('mealFingerprint', () => {
  const base = { name: 'Tacos', weekOf: '2026-11-15', dayOfWeek: 'friday', mealType: 'dinner', servings: 4 };
  it('ignores the time of day, which neither source keeps as Prism does', () => {
    expect(mealFingerprint({ ...base })).toBe(mealFingerprint({ ...base, mealTime: '18:30' } as typeof base));
  });
  it('can leave servings out, for a source with none (Mealie)', () => {
    expect(mealFingerprint(base, { servings: false })).toBe(mealFingerprint({ ...base, servings: null }, { servings: false }));
    expect(mealFingerprint(base)).not.toBe(mealFingerprint({ ...base, servings: null }));
  });
});
