/**
 * The dock (#922): six pages on it, the rest behind More, none lost.
 */
import { ALL_NAV_ITEMS } from '../navItems';
import { dockLayout, DOCK_SIZE } from '../dock';

describe('dockLayout', () => {
  it('puts Home, Calendar, Chores, Shopping, Meals and Photos on the dock', () => {
    const { dock } = dockLayout(ALL_NAV_ITEMS);
    expect(dock.map((i) => i.href)).toEqual(['/', '/calendar', '/chores', '/shopping', '/meals', '/photos']);
  });

  it('keeps every visible page reachable, once, with Settings behind More', () => {
    const { dock, more } = dockLayout(ALL_NAV_ITEMS);
    const all = [...dock, ...more].map((i) => i.href).sort();
    expect(all).toEqual(ALL_NAV_ITEMS.map((i) => i.href).sort());
    expect(more.map((i) => i.href)).toContain('/settings');
    expect(dock.map((i) => i.href)).not.toContain('/settings');
  });

  it('tops the dock up from the other pages when a chosen one is hidden', () => {
    const visible = ALL_NAV_ITEMS.filter((i) => i.href !== '/meals' && i.href !== '/photos');
    const { dock, more } = dockLayout(visible);
    expect(dock).toHaveLength(DOCK_SIZE);
    expect(dock.map((i) => i.href)).not.toContain('/meals');
    expect([...dock, ...more]).toHaveLength(visible.length);
  });

  it('follows a household choice', () => {
    const { dock } = dockLayout(ALL_NAV_ITEMS, ['/', '/recipes', '/messages']);
    expect(dock.slice(0, 3).map((i) => i.href)).toEqual(['/', '/recipes', '/messages']);
  });
});
