/**
 * @jest-environment jsdom
 *
 * A selected widget's own settings sit in the editor's Widgets panel (#1323),
 * at the panel's size, not in a strip of small pop-ups over the canvas: Fill,
 * Outline, Text (with Align for the clock and the weather), the calendar's
 * Grid, Hide when empty and Hide first on a small screen. Selecting a widget
 * brings the Widgets panel forward, the canvas shows only the screen, and the
 * keys still move and remove the selected widget (#987).
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';
import { WidgetsSheet } from '../EditorSheets';
import { WidgetStylePanel } from '../WidgetStylePanel';
import { LayoutEditor } from '../LayoutEditor';
import { LayoutGridEditor } from '../LayoutGridEditor';

jest.mock('@/components/providers', () => ({
  ...jest.requireActual('@/components/providers'),
  useTheme: () => ({ resolvedTheme: 'light' }),
}));
// The grid measures its box, which jsdom does not lay out.
jest.mock('../grid/useSquareCells', () => ({
  useSquareCells: () => ({ width: 1200, containerRef: () => {}, mounted: true, cellSize: 20 }),
}));
// The grid editor is loaded on demand in the app; here, at once.
jest.mock('next/dynamic', () => () => jest.requireActual('../grid/CssGridEditor').CssGridEditor);

const LAYOUT: WidgetConfig[] = [
  { i: 'clock', x: 0, y: 0, w: 6, h: 4 },
  { i: 'tasks', x: 6, y: 0, w: 8, h: 6 },
  { i: 'weather', x: 0, y: 4, w: 6, h: 4, visible: false },
];

/** The Widgets panel, holding its layout as the editor does. */
function Sheet({ selected, start = LAYOUT, onChange, onSelect, screensaver = false, hideEmptyByDefault }: {
  selected: string | null;
  start?: WidgetConfig[];
  onChange?: (w: WidgetConfig[]) => void;
  onSelect?: (id: string | null) => void;
  screensaver?: boolean;
  hideEmptyByDefault?: boolean;
}) {
  const [widgets, setWidgets] = useState(start);
  const change = (w: WidgetConfig[]) => { setWidgets(w); onChange?.(w); };
  return (
    <WidgetsSheet
      builtIn={false}
      editingScreensaver={screensaver}
      orientation="landscape"
      widgets={widgets}
      onWidgetsChange={screensaver ? () => { throw new Error('the screensaver layout is changed by its own handler'); } : change}
      onScreensaverPreset={screensaver ? change : undefined}
      onApplyCommunityLayout={() => {}}
      onFocusedWidgetChange={() => {}}
      selectedWidgetId={selected}
      onSelectedWidgetChange={onSelect}
      hideEmptyByDefault={hideEmptyByDefault}
    />
  );
}

const last = (spy: jest.Mock): WidgetConfig[] => spy.mock.calls[spy.mock.calls.length - 1][0];
const widget = (spy: jest.Mock, id: string) => last(spy).find((w) => w.i === id)!;

describe("a selected widget's settings in the Widgets panel (#1323)", () => {
  it('shows Fill, Outline, Text and Hide when empty for the selected widget', () => {
    render(<Sheet selected="tasks" />);
    const settings = document.querySelector('[data-widget-settings="tasks"]') as HTMLElement;
    expect(settings).not.toBeNull();
    for (const name of ['Fill', 'Outline', 'Text', 'When it shows']) {
      expect(within(settings).getByRole('heading', { name })).toBeTruthy();
    }
    expect(within(settings).getByRole('heading', { name: 'Tasks' })).toBeTruthy();
    expect(within(settings).getByRole('button', { name: 'Transparent fill' })).toBeTruthy();
    expect(within(settings).getByRole('button', { name: 'No outline' })).toBeTruthy();
    expect(within(settings).getByRole('group', { name: 'Text size' })).toBeTruthy();
    expect(within(settings).getByRole('button', { name: /Hide when empty/ })).toBeTruthy();
    expect(within(settings).getByRole('button', { name: /Hide first on a small screen/ })).toBeTruthy();
  });

  it('is absent with nothing selected, or with a hidden widget selected', () => {
    const { unmount } = render(<Sheet selected={null} />);
    expect(document.querySelector('[data-widget-settings]')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Fill' })).toBeNull();
    // The settings keep their place under the list, as one line and no swatches.
    const empty = document.querySelector('[data-widget-settings-section]') as HTMLElement;
    expect(empty.textContent).toBe('Pick a widget above to change its fill, outline and text.');
    expect(empty.querySelector('button')).toBeNull();
    unmount();
    render(<Sheet selected="weather" />);
    expect(document.querySelector('[data-widget-settings]')).toBeNull();
  });

  it("lists the widgets first, then the selected one's settings, then the templates", () => {
    render(<Sheet selected="tasks" />);
    const list = document.querySelector('[data-widget-row="clock"]')!;
    const settings = document.querySelector('[data-widget-settings="tasks"]')!;
    const templates = screen.getByRole('heading', { name: 'Start from a template' });
    expect(list.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(settings.compareDocumentPosition(templates) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('a tap on a row in the list selects that widget, marks its row, and the settings follow', () => {
    function Selecting() {
      const [selected, setSelected] = useState<string | null>(null);
      return <Sheet selected={selected} onSelect={setSelected} />;
    }
    render(<Selecting />);
    const row = (id: string) => document.querySelector(`[data-widget-row="${id}"]`) as HTMLElement;
    expect(row('clock').getAttribute('aria-selected')).toBe('false');
    fireEvent.click(within(row('clock')).getByRole('button', { name: 'Clock' }));
    // Selected, not hidden as a tap on the name used to do.
    expect(row('clock')).not.toBeNull();
    expect(row('clock').getAttribute('aria-selected')).toBe('true');
    expect(row('clock').className).toMatch(/bg-primary/);
    expect(document.querySelector('[data-widget-settings="clock"]')).not.toBeNull();

    fireEvent.click(within(row('tasks')).getByRole('button', { name: 'Tasks' }));
    expect(row('tasks').getAttribute('aria-selected')).toBe('true');
    expect(row('clock').getAttribute('aria-selected')).toBe('false');
    expect(document.querySelector('[data-widget-settings="tasks"]')).not.toBeNull();
    expect(document.querySelector('[data-widget-settings="clock"]')).toBeNull();
  });

  it("a widget selected on the canvas has its row marked, and the row's Hide still hides it", () => {
    const onChange = jest.fn();
    render(<Sheet selected="tasks" onChange={onChange} onSelect={() => {}} />);
    expect(document.querySelector('[data-widget-row="tasks"]')!.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Hide Clock' }));
    expect(widget(onChange, 'clock').visible).toBe(false);
  });

  it('Glass changes the layout, says what it is, and leaves the other widgets be', () => {
    const onChange = jest.fn();
    render(<Sheet selected="tasks" onChange={onChange} />);
    expect(document.querySelector('[data-fill-name]')?.textContent).toMatch(/^Default/);
    fireEvent.click(screen.getByRole('button', { name: 'Glass fill' }));
    expect(widget(onChange, 'tasks').backgroundColor).toBe('glass');
    expect(widget(onChange, 'clock')).toEqual(LAYOUT[0]);
    expect(document.querySelector('[data-fill-name]')?.textContent).toMatch(/^Glass/);
    expect(screen.getByRole('button', { name: 'Glass fill' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a coloured fill has an opacity, and Frosted a blur', () => {
    const onChange = jest.fn();
    render(<Sheet selected="tasks" start={[{ ...LAYOUT[1]!, backgroundColor: '#0EA5E9' }]} onChange={onChange} />);
    fireEvent.click(within(screen.getByRole('group', { name: 'Fill opacity' })).getByRole('button', { name: '50%' }));
    expect(widget(onChange, 'tasks')).toMatchObject({ backgroundColor: '#0EA5E9', backgroundOpacity: 0.5 });

    fireEvent.click(screen.getByRole('button', { name: 'Frosted fill' }));
    expect(screen.queryByRole('group', { name: 'Fill opacity' })).toBeNull();
    fireEvent.click(within(screen.getByRole('group', { name: 'Fill blur' })).getByRole('button', { name: 'Heavy' }));
    expect(widget(onChange, 'tasks')).toMatchObject({ backgroundColor: 'frosted', backgroundOpacity: 0.75 });

    // Default puts the fill back and its opacity with it.
    fireEvent.click(screen.getByRole('button', { name: 'Default fill' }));
    expect(widget(onChange, 'tasks').backgroundColor).toBeUndefined();
    expect(widget(onChange, 'tasks').backgroundOpacity).toBe(1);
  });

  it('Outline None, a text size and Hide when empty change the widget', () => {
    const onChange = jest.fn();
    render(<Sheet selected="tasks" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'No outline' }));
    expect(widget(onChange, 'tasks').outlineColor).toBe('transparent');
    fireEvent.click(within(screen.getByRole('group', { name: 'Text size' })).getByRole('button', { name: 'L' }));
    expect(widget(onChange, 'tasks').textScale).toBe(1.25);
    const hide = screen.getByRole('button', { name: /Hide when empty/ });
    expect(hide.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(hide);
    expect(widget(onChange, 'tasks').hideWhenEmpty).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Hide first on a small screen/ }));
    expect(widget(onChange, 'tasks').hideOnSmallScreen).toBe(true);
  });

  it('for the clock, Text has Align across and up and down; other widgets have none', () => {
    const onChange = jest.fn();
    const { unmount } = render(<Sheet selected="clock" onChange={onChange} />);
    expect(document.querySelector('[data-align-axis="x"]')).not.toBeNull();
    expect(document.querySelector('[data-align-axis="y"]')).not.toBeNull();
    fireEvent.click(within(screen.getByRole('group', { name: 'Align across' })).getByRole('button', { name: 'Right' }));
    expect(widget(onChange, 'clock').settings).toEqual({ align: { x: 'right' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Align up and down' })).getByRole('button', { name: 'Bottom' }));
    expect(widget(onChange, 'clock').settings).toEqual({ align: { x: 'right', y: 'bottom' } });
    // The clock has no empty state, so no Hide when empty.
    expect(screen.queryByRole('button', { name: /Hide when empty/ })).toBeNull();
    unmount();
    render(<Sheet selected="tasks" />);
    expect(document.querySelector('[data-align-axis]')).toBeNull();
  });

  it('the calendar has its Grid', () => {
    const onChange = jest.fn();
    render(<Sheet selected="calendar" start={[{ i: 'calendar', x: 0, y: 0, w: 20, h: 12 }]} onChange={onChange} />);
    expect(screen.getByRole('heading', { name: 'Grid' })).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Grid line opacity' })).getByRole('button', { name: '25%' }));
    expect(widget(onChange, 'calendar').gridLineOpacity).toBe(0.25);
  });

  it('on the screensaver, an unset widget hides when empty, and changes go to the screensaver layout', () => {
    const onChange = jest.fn();
    render(<Sheet selected="tasks" screensaver hideEmptyByDefault onChange={onChange} />);
    const hide = screen.getByRole('button', { name: /Hide when empty/ });
    expect(hide.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(hide);
    expect(widget(onChange, 'tasks').hideWhenEmpty).toBe(false);
  });

  it('Close lets the widget go', () => {
    const onSelect = jest.fn();
    render(<Sheet selected="tasks" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: "Close Tasks's settings" }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe('Apply to all widgets, the look a new widget takes, and templates asking first (#1339)', () => {
  it("Apply to all widgets puts the selected widget's outline on every widget, and then says they all match", () => {
    const onChange = jest.fn();
    render(<Sheet selected="tasks" start={[LAYOUT[0]!, { ...LAYOUT[1]!, outlineColor: 'transparent', backgroundColor: 'glass' }, LAYOUT[2]!]} onChange={onChange} />);
    const outline = document.querySelector('[data-apply-all="outline"]') as HTMLElement;
    expect(outline.querySelector('[data-apply-all-note]')!.textContent).toBe('1 widget has a different outline.');
    fireEvent.click(within(outline).getByRole('button', { name: 'Apply this outline to all widgets' }));
    for (const w of last(onChange)) expect(w.outlineColor).toBe('transparent');
    // Only the outline: the clock keeps its own fill.
    expect(widget(onChange, 'clock').backgroundColor).toBeUndefined();
    expect(outline.querySelector('[data-apply-all-note]')!.textContent).toBe('Every widget has this outline.');
    expect((within(outline).getByRole('button', { name: 'Apply this outline to all widgets' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Apply this fill to all widgets' }));
    for (const w of last(onChange)) expect(w.backgroundColor).toBe('glass');
  });

  it('Apply to all widgets for Text carries the text size', () => {
    const onChange = jest.fn();
    render(<Sheet selected="tasks" start={[LAYOUT[0]!, { ...LAYOUT[1]!, textScale: 1.25 }]} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply this text colour and size to all widgets' }));
    expect(widget(onChange, 'clock').textScale).toBe(1.25);
  });

  it('a widget added from the list takes the outline every widget shares', () => {
    const onChange = jest.fn();
    const start = LAYOUT.slice(0, 2).map((w) => ({ ...w, outlineColor: 'transparent' }));
    render(<Sheet selected={null} start={start} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Add widget/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Weather' }));
    expect(widget(onChange, 'weather').outlineColor).toBe('transparent');
  });

  it('a template asks before it replaces every widget, and Cancel leaves them be', async () => {
    const onChange = jest.fn();
    render(<Sheet selected={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Family Central' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toMatch(/replaces every widget on this dashboard/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await act(async () => {});
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Family Central' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Replace' }));
    await act(async () => {});
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

describe('the editor: selecting a widget brings Widgets forward (#1323)', () => {
  const editor = (selectedWidgetId: string | null) => (
    <LayoutEditor
      widgets={LAYOUT}
      onWidgetsChange={() => {}}
      onSave={() => {}}
      onSaveAs={() => {}}
      onReset={() => {}}
      onCancel={() => {}}
      selectedWidgetId={selectedWidgetId}
    />
  );

  it('opens Widgets on a new selection, and leaves another panel open after it', () => {
    const { rerender } = render(editor(null));
    fireEvent.click(document.querySelector('[data-editor-open="look"]')!);
    expect(document.querySelector('[data-editor-sheet="look"]')).not.toBeNull();

    rerender(editor('clock'));
    expect(document.querySelector('[data-editor-sheet="widgets"] [data-widget-settings="clock"]')).not.toBeNull();

    // Look again, the clock still selected: Look stays.
    fireEvent.click(document.querySelector('[data-editor-open="look"]')!);
    rerender(editor('clock'));
    expect(document.querySelector('[data-editor-sheet="look"]')).not.toBeNull();

    // Another widget is a new selection.
    rerender(editor('tasks'));
    expect(document.querySelector('[data-editor-sheet="widgets"] [data-widget-settings="tasks"]')).not.toBeNull();
  });
});

describe('the canvas shows only the screen (#1323)', () => {
  /** The canvas as the editor drives it: the selection held outside, as Dashboard holds it. */
  function Canvas({ onLayout, onSelect }: { onLayout: (w: WidgetConfig[]) => void; onSelect: (id: string | null) => void }) {
    const [layout, setLayout] = useState(LAYOUT);
    const [selected, setSelected] = useState<string | null>(null);
    return (
      <LayoutGridEditor
        layout={layout}
        onLayoutChange={(w) => { setLayout(w); onLayout(w); }}
        isEditable
        renderWidget={(w) => <div>{w.i} widget</div>}
        selectedWidgetId={selected}
        onSelectedWidgetChange={(id) => { setSelected(id); onSelect(id); }}
      />
    );
  }

  it('a selected widget puts no strip of settings over the canvas, and the keys still move and remove it', () => {
    const onLayout = jest.fn();
    const onSelect = jest.fn();
    const { container } = render(<Canvas onLayout={onLayout} onSelect={onSelect} />);
    const clock = container.querySelector('[data-editor-widget="clock"]') as HTMLElement;
    expect(clock).not.toBeNull();
    fireEvent.click(clock);
    // Selected, and marked so on the canvas.
    expect((container.querySelector('[data-editor-widget="clock"]') as HTMLElement).className).toMatch(/ring-blue-500/);

    expect(within(container).queryByRole('button', { name: /^Fill/ })).toBeNull();
    expect(within(container).queryByRole('button', { name: /^Outline/ })).toBeNull();
    expect(within(container).queryByRole('button', { name: /^Text/ })).toBeNull();
    expect(within(container).queryByRole('button', { name: /Hide when empty/ })).toBeNull();
    expect(within(container).queryByRole('button', { name: 'Close properties' })).toBeNull();
    // The selection is the editor's, for the Widgets panel.
    expect(onSelect).toHaveBeenCalledWith('clock');

    // #987: an arrow moves the selected widget a cell; Delete removes it.
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true })); });
    expect(widget(onLayout, 'clock').x).toBe(1);
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', cancelable: true })); });
    expect(widget(onLayout, 'clock').visible).toBe(false);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });
});

describe('keys pressed in the settings reach the canvas (#987)', () => {
  const clock = LAYOUT[0]!;
  let heard: string[] = [];
  const listen = (e: KeyboardEvent) => { heard.push(e.key); };
  beforeEach(() => { heard = []; window.addEventListener('keydown', listen); });
  afterEach(() => window.removeEventListener('keydown', listen));

  it('from the editor page, another window, they are passed on to the canvas', () => {
    const page = document.createElement('iframe');
    document.body.appendChild(page);
    const root = page.contentDocument!.body;
    const { unmount } = render(createPortal(<WidgetStylePanel widget={clock} onChange={() => {}} />, root));
    const glass = within(root).getByRole('button', { name: 'Glass fill' });
    fireEvent.keyDown(glass, { key: 'ArrowRight' });
    fireEvent.keyDown(glass, { key: 'Backspace' });
    // Not a key the canvas uses.
    fireEvent.keyDown(glass, { key: 'a' });
    expect(heard).toEqual(['ArrowRight', 'Backspace']);
    unmount();
    page.remove();
  });

  it('on the same page, the canvas hears them once', () => {
    render(<WidgetStylePanel widget={clock} onChange={() => {}} />);
    fireEvent.keyDown(screen.getByRole('button', { name: 'Glass fill' }), { key: 'ArrowRight' });
    expect(heard).toEqual(['ArrowRight']);
  });
});
