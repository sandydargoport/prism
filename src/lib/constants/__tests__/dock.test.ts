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

  it('never shows a hidden page, even one the household put on the dock (#925)', () => {
    const visible = ALL_NAV_ITEMS.filter((i) => i.href !== '/recipes');
    const { dock, more } = dockLayout(visible, ['/', '/recipes', '/messages']);
    expect([...dock, ...more].map((i) => i.href)).not.toContain('/recipes');
    expect(dock[1]!.href).toBe('/messages');
  });

  it('shows only Home and the chosen pages, however few (#1173)', () => {
    expect(dockLayout(ALL_NAV_ITEMS, ['/']).dock.map((i) => i.href)).toEqual(['/']);
    const { dock, more } = dockLayout(ALL_NAV_ITEMS, ['/', '/recipes']);
    expect(dock.map((i) => i.href)).toEqual(['/', '/recipes']);
    expect([...dock, ...more]).toHaveLength(ALL_NAV_ITEMS.length);
  });

  it('does not fill a switched-off page\'s place with an unchosen one (#1173)', () => {
    const visible = ALL_NAV_ITEMS.filter((i) => i.href !== '/goals');
    const { dock } = dockLayout(visible, ['/', '/calendar', '/tasks', '/chores', '/goals', '/shopping']);
    expect(dock.map((i) => i.href)).toEqual(['/', '/calendar', '/tasks', '/chores', '/shopping']);
  });

  it('keeps Home on the dock even when a saved choice leaves it out', () => {
    expect(dockLayout(ALL_NAV_ITEMS, ['/recipes']).dock.map((i) => i.href)).toEqual(['/', '/recipes']);
  });
});
