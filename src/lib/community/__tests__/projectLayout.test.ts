import { projectCommunityLayout } from '../validateLayout';

/**
 * What a community submission is allowed to put in the repository.
 *
 * The layout submission workflow runs with `contents: write` and opens a PR
 * against a public repo. It used to commit the parsed submission itself, and
 * `validateCommunityLayout` checks the fields it knows about without rejecting
 * the ones it does not, so any extra property a submitter attached was written
 * verbatim into a published file and served to every instance that browses the
 * gallery.
 *
 * These tests pin the projection, which is what makes an unknown key impossible
 * rather than merely unexpected. They are deliberately about SHAPE, not about
 * the contents of any particular field: the point is that a key nobody
 * anticipated has no path in, whatever someone thinks of next.
 */

const valid = {
  type: 'prism-layout',
  version: 1,
  mode: 'dashboard',
  name: 'Kitchen wall',
  description: 'A layout',
  author: 'Someone',
  tags: ['kitchen'],
  screenSizes: ['1080p'],
  orientation: 'landscape',
  widgets: [{ i: 'clock', x: 0, y: 0, w: 4, h: 2 }],
};

describe('projectCommunityLayout', () => {
  it('keeps every field the gallery actually uses', () => {
    const out = projectCommunityLayout(valid);

    expect(out).toEqual({
      type: 'prism-layout',
      version: 1,
      mode: 'dashboard',
      name: 'Kitchen wall',
      description: 'A layout',
      author: 'Someone',
      tags: ['kitchen'],
      screenSizes: ['1080p'],
      orientation: 'landscape',
      widgets: [{ i: 'clock', x: 0, y: 0, w: 4, h: 2 }],
    });
  });

  it('drops unknown root keys', () => {
    const out = projectCommunityLayout({
      ...valid,
      notes: 'anything at all',
      contact: 'anything at all',
      __proto__unexpected: 'anything at all',
    }) as unknown as Record<string, unknown>;

    expect(Object.keys(out).sort()).toEqual([
      'author', 'description', 'mode', 'name', 'orientation',
      'screenSizes', 'tags', 'type', 'version', 'widgets',
    ]);
    expect(out.notes).toBeUndefined();
    expect(out.contact).toBeUndefined();
  });

  it('drops unknown widget keys', () => {
    const out = projectCommunityLayout({
      ...valid,
      widgets: [{ i: 'clock', x: 0, y: 0, w: 4, h: 2, label: 'anything', payload: { a: 1 } }],
    });

    expect(Object.keys(out.widgets[0]!).sort()).toEqual(['h', 'i', 'w', 'x', 'y']);
  });

  it('carries the optional widget appearance fields only when supplied', () => {
    const bare = projectCommunityLayout(valid);
    expect(bare.widgets[0]).not.toHaveProperty('backgroundColor');

    const styled = projectCommunityLayout({
      ...valid,
      widgets: [{ i: 'clock', x: 0, y: 0, w: 4, h: 2, backgroundColor: '#fff', backgroundOpacity: 0.5, visible: true }],
    });
    expect(styled.widgets[0]).toMatchObject({
      backgroundColor: '#fff',
      backgroundOpacity: 0.5,
      visible: true,
    });
  });

  it('asserts the type rather than copying it', () => {
    const out = projectCommunityLayout({ ...valid, type: 'something-else' });
    expect(out.type).toBe('prism-layout');
  });

  it('carries a valid version and normalises anything else to the current one', () => {
    // Every layout in community/layouts is version 2. Pinning this to 1 would
    // downgrade every new submission to a format nothing else in the gallery
    // uses, which is the kind of quiet divergence a projection is supposed to
    // prevent rather than cause.
    expect(projectCommunityLayout({ ...valid, version: 2 }).version).toBe(2);
    expect(projectCommunityLayout({ ...valid, version: 1 }).version).toBe(1);
    expect(projectCommunityLayout({ ...valid, version: 99 }).version).toBe(2);
    expect(projectCommunityLayout({ ...valid, version: undefined }).version).toBe(2);
  });

  it('survives a submission with no widgets array at all', () => {
    const out = projectCommunityLayout({ ...valid, widgets: undefined });
    expect(out.widgets).toEqual([]);
  });
});

// How a layout is drawn travels with it (#907).
describe('the Today view in a shared layout', () => {
  it('a Today layout exported and imported again is still Today', () => {
    const exported = projectCommunityLayout({ ...valid, view: 'today' });
    expect(exported.view).toBe('today');
    expect(projectCommunityLayout(JSON.parse(JSON.stringify(exported))).view).toBe('today');
  });

  it('a grid layout says nothing, and an unknown view becomes the grid', () => {
    expect('view' in projectCommunityLayout(valid)).toBe(false);
    expect('view' in projectCommunityLayout({ ...valid, view: 'freeform' })).toBe(false);
    // The retired Calendar layout (#1154) is shared as a regular grid.
    expect('view' in projectCommunityLayout({ ...valid, view: 'calendar' })).toBe(false);
  });
});

// Today's parts travel with it (#927): shown or hidden, staying when idle,
// days ahead and text size, and no other setting.
describe('Today parts in a shared layout', () => {
  it('keeps each part\'s choices and the scene settings', () => {
    const out = projectCommunityLayout({
      ...valid,
      view: 'today',
      widgets: [
        { i: 'chores', x: 0, y: 0, w: 4, h: 2, visible: false, showWhenIdle: true },
        { i: 'calendar', x: 0, y: 2, w: 4, h: 2, settings: { daysAhead: 2, textSize: 'large', apiKey: 'x', daysAheadExtra: 9 } },
      ],
    });
    expect(out.widgets[0]).toMatchObject({ visible: false, showWhenIdle: true });
    expect(out.widgets[1]!.settings).toEqual({ daysAhead: 2, textSize: 'large' });
  });

  it('drops a scene setting out of range', () => {
    const out = projectCommunityLayout({ ...valid, widgets: [{ i: 'calendar', x: 0, y: 0, w: 4, h: 2, settings: { daysAhead: 30, textSize: 'huge' } }] });
    expect('settings' in out.widgets[0]!).toBe(false);
  });
});


// #803: a widget's "Hide first on a small screen" travels with a shared
// layout; a layout that says nothing about it stores nothing.
describe('small-screen drop-out in a shared layout', () => {
  it('keeps the choice when given, and adds nothing when not', () => {
    const out = projectCommunityLayout({
      ...valid,
      widgets: [
        { i: 'chores', x: 0, y: 0, w: 4, h: 2, hideOnSmallScreen: true },
        { i: 'calendar', x: 0, y: 2, w: 4, h: 2 },
        { i: 'weather', x: 4, y: 0, w: 4, h: 2, hideOnSmallScreen: 'yes' },
      ],
    });
    expect(out.widgets[0]!.hideOnSmallScreen).toBe(true);
    expect('hideOnSmallScreen' in out.widgets[1]!).toBe(false);
    expect('hideOnSmallScreen' in out.widgets[2]!).toBe(false);
  });
});
