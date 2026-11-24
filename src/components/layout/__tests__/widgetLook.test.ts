/**
 * Apply to all widgets and the look a new widget takes (#1339).
 */
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { applyLookToAll, countDiffering, withSharedLook } from '../widgetLook';

const at = (i: string, look: Partial<WidgetConfig> = {}): WidgetConfig => ({ i, x: 0, y: 0, w: 4, h: 4, ...look });

describe('applyLookToAll', () => {
  const source = at('clock', { outlineColor: 'transparent', backgroundColor: '#112233', backgroundOpacity: 0.5, textColor: '#ffffff', textScale: 1.25 });
  const widgets = [
    source,
    at('tasks', { outlineColor: '#ff0000', outlineOpacity: 0.5, backgroundColor: 'glass' }),
    at('weather', { visible: false }),
  ];

  it('puts the outline on every widget, hidden ones too, and nothing else', () => {
    const next = applyLookToAll(widgets, source, 'outline');
    for (const w of next) expect(w.outlineColor).toBe('transparent');
    // The outline's opacity goes with it: unset on the source, unset on each.
    expect(next[1]).not.toHaveProperty('outlineOpacity');
    // The fill is left as each widget has it.
    expect(next[1]!.backgroundColor).toBe('glass');
    expect(next[2]!.backgroundColor).toBeUndefined();
  });

  it('puts the fill and its opacity on every widget', () => {
    const next = applyLookToAll(widgets, source, 'fill');
    for (const w of next) {
      expect(w.backgroundColor).toBe('#112233');
      expect(w.backgroundOpacity).toBe(0.5);
    }
    expect(next[1]!.outlineColor).toBe('#ff0000');
  });

  it('puts the text colour and size on every widget', () => {
    const next = applyLookToAll(widgets, source, 'text');
    for (const w of next) {
      expect(w.textColor).toBe('#ffffff');
      expect(w.textScale).toBe(1.25);
    }
  });

  it('puts the default back on every widget when the source has the default', () => {
    const next = applyLookToAll(widgets, at('tasks'), 'outline');
    for (const w of next) expect(w.outlineColor).toBeUndefined();
  });

  it('counts the widgets on show that differ, an unset value matching its default', () => {
    expect(countDiffering(widgets, source, 'outline')).toBe(1);
    expect(countDiffering([at('a', { textScale: 1 }), at('b')], at('a', { textScale: 1 }), 'text')).toBe(0);
    expect(countDiffering(applyLookToAll(widgets, source, 'outline'), source, 'outline')).toBe(0);
  });
});

describe('withSharedLook: a new widget', () => {
  const added = at('photo');

  it('takes the outline, fill and text every widget on show shares', () => {
    const widgets = [
      at('clock', { outlineColor: 'transparent', backgroundColor: 'glass', textColor: '#000000' }),
      at('tasks', { outlineColor: 'transparent', backgroundColor: 'glass', textColor: '#000000' }),
      // A hidden widget does not count.
      at('weather', { visible: false, outlineColor: '#ff0000' }),
    ];
    const next = withSharedLook(widgets, added);
    expect(next.outlineColor).toBe('transparent');
    expect(next.backgroundColor).toBe('glass');
    expect(next.textColor).toBe('#000000');
  });

  it('keeps its own look for a part the others do not agree on', () => {
    const widgets = [
      at('clock', { outlineColor: 'transparent', backgroundColor: 'glass' }),
      at('tasks', { outlineColor: 'transparent', backgroundColor: '#112233' }),
    ];
    const next = withSharedLook(widgets, added);
    expect(next.outlineColor).toBe('transparent');
    expect(next.backgroundColor).toBeUndefined();
  });

  it('is the plain default on an empty dashboard', () => {
    expect(withSharedLook([], added)).toEqual(added);
  });
});
