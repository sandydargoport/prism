/**
 * Today is the one built-in dashboard (#1151): a new install starts on it, and
 * the retired Calendar ready-made dashboard is no longer created.
 */
import { isBuiltInView, newLookLayouts } from '../newLook';

describe('a new install', () => {
  it('starts on Today, the default, and nothing else', () => {
    expect(newLookLayouts().map((l) => [l.view, l.isDefault])).toEqual([['today', true]]);
  });
});

describe('the built-in dashboard', () => {
  it('is Today only', () => {
    expect(isBuiltInView('today')).toBe(true);
    expect(isBuiltInView('calendar')).toBe(false);
    expect(isBuiltInView('grid')).toBe(false);
    expect(isBuiltInView(null)).toBe(false);
  });
});
