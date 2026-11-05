/**
 * Trying the new look (#808).
 */
import { newLookLayouts, planNewLook, shouldOfferNewLook } from '../newLook';

describe('planNewLook', () => {
  const existing = [
    { id: 'kitchen', isDefault: true, view: 'grid' },
    { id: 'hall', isDefault: false, view: 'grid' },
  ];

  it('adds Today as the default and the Calendar layout, and remembers the old default', () => {
    const plan = planNewLook(existing);
    expect(plan.create.map((l) => [l.view, l.isDefault])).toEqual([['today', true], ['calendar', false]]);
    expect(plan.previousDefaultId).toBe('kitchen');
  });

  it('never includes an existing layout: it only adds', () => {
    const plan = planNewLook(existing);
    expect(plan.create.every((l) => !('id' in l))).toBe(true);
  });

  it('does not add a second Today or Calendar', () => {
    expect(planNewLook([...existing, { id: 'cal', isDefault: false, view: 'calendar' }]).create.map((l) => l.view)).toEqual(['today']);
  });
});

describe('shouldOfferNewLook', () => {
  it('offers it once to a household with layouts and no Today', () => {
    expect(shouldOfferNewLook([{ view: 'grid' }], false, false)).toBe(true);
    expect(shouldOfferNewLook([{ view: 'grid' }, { view: 'today' }], false, false)).toBe(false);
    expect(shouldOfferNewLook([{ view: 'grid' }], true, false)).toBe(false);
    expect(shouldOfferNewLook([{ view: 'grid' }], false, true)).toBe(false);
    expect(shouldOfferNewLook([], false, false)).toBe(false);
  });
});

describe('newLookLayouts', () => {
  it('makes Today the default and leaves the Calendar layout beside it', () => {
    expect(newLookLayouts().filter((l) => l.isDefault).map((l) => l.view)).toEqual(['today']);
  });
});
