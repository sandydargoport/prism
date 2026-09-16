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
