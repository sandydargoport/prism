/**
 * @jest-environment jsdom
 */
import { getBuiltinTheme } from '../appThemes';
import { PAPER } from '@/lib/design/tokens';

jest.mock('@/lib/db/client', () => ({ db: {} }));
import { firstPaintScript } from '../serverTheme';

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
