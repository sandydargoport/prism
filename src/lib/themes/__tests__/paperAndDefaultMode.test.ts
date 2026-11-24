/**
 * @jest-environment jsdom
 */
import { getBuiltinTheme } from '../appThemes';
import { PAPER } from '@/lib/design/tokens';

jest.mock('@/lib/db/client', () => ({ db: {} }));
import { FIRST_PAINT_HOST_GLOBAL, firstPaintScript } from '../serverTheme';
import { PERF_CLASS, PERF_CLASS_SCRIPT } from '@/lib/perfLevel';
import { REMOTE_EDIT_GLOBAL } from '@/lib/displays/remoteEdit';

// #808: new installs start on the Paper palette, and the Night look makes dark
// the household default for displays that never chose.

describe('Paper palette', () => {
  it('is a built-in theme with the checked design tokens', () => {
    const paper = getBuiltinTheme('paper');
    expect(paper?.light).toEqual(PAPER.light);
    expect(paper?.dark).toEqual(PAPER.dark);
  });
});

describe('first-paint script', () => {
  const run = (defaultMode: 'light' | 'dark' | 'system', stored: string | null, systemDark = false) => {
    document.documentElement.className = '';
    localStorage.clear();
    if (stored) localStorage.setItem('prism-theme', stored);
    window.matchMedia = ((q: string) => ({ matches: systemDark && q.includes('dark') })) as unknown as typeof window.matchMedia;
    new Function(firstPaintScript(defaultMode, ''))();
    return document.documentElement.classList.contains('dark');
  };

  it('a display that never chose takes the household default', () => {
    expect(run('dark', null)).toBe(true);
    expect(run('light', null, true)).toBe(false);
  });

  it("a display's own choice wins over the household default", () => {
    expect(run('dark', 'light')).toBe(false);
    expect(run('light', 'dark')).toBe(true);
  });

  it('with no household default, follows the system as before', () => {
    expect(run('system', null, true)).toBe(true);
    expect(run('system', null, false)).toBe(false);
  });

  it('never places anything but a known mode in the script', () => {
    expect(firstPaintScript("x';alert(1)//" as 'dark', '')).toContain("||'system'");
  });
});

// #1340: in the editor's frame for a named screen, the first paint draws the
// edited screen, not the laptop or phone doing the editing.
describe('first-paint script in the frame of a screen being edited', () => {
  const run = (screen: Record<string, string>, own: Record<string, string>, systemDark: boolean, displayId: string | null = 'hallway') => {
    document.documentElement.className = '';
    localStorage.clear();
    for (const [k, v] of Object.entries(own)) localStorage.setItem(k, v);
    const matchMedia = ((q: string) => ({ matches: systemDark && q.includes('dark') })) as unknown as typeof window.matchMedia;
    window.matchMedia = matchMedia;
    const parent = { [FIRST_PAINT_HOST_GLOBAL]: { displayId, settings: screen } };
    // The frame's window: its parent is the editor page.
    const frame = { parent, matchMedia };
    new Function('window', firstPaintScript('system', PERF_CLASS_SCRIPT))(frame);
    return document.documentElement.classList;
  };

  it('a Light screen paints light on a dark-preferring editor that chose dark', () => {
    expect(run({ 'prism-theme': 'light' }, { 'prism-theme': 'dark' }, true).contains('dark')).toBe(false);
  });

  it('a Dark screen paints dark on an editor that chose light', () => {
    expect(run({ 'prism-theme': 'dark' }, { 'prism-theme': 'light' }, false).contains('dark')).toBe(true);
  });

  it("the screen's performance mode, not the editor's, sets the performance class", () => {
    expect(run({ 'prism-perf-mode': 'reduced' }, { 'prism-perf-mode': 'full' }, false).contains(PERF_CLASS)).toBe(true);
    expect(run({ 'prism-perf-mode': 'full' }, { 'prism-perf-mode': 'reduced' }, false).contains(PERF_CLASS)).toBe(false);
  });

  it("a screen key the screen never set is unset, not the editor's own value", () => {
    expect(run({}, { 'prism-theme': 'dark' }, false).contains('dark')).toBe(false);
  });

  it("editing a dashboard with no screen keeps the editing device's own", () => {
    expect(run({ 'prism-theme': 'light' }, { 'prism-theme': 'dark' }, false, null).contains('dark')).toBe(true);
  });

  it('looks for the host under the name the editor page uses', () => {
    expect(FIRST_PAINT_HOST_GLOBAL).toBe(REMOTE_EDIT_GLOBAL);
  });
});
